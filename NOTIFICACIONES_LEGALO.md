# Notificaciones LÉGALO (abogados)

Documentación de lo implementado para **notificaciones in-app** (campana en el dashboard) y **notificaciones push** (Expo + Supabase Edge Function), más los pasos que debes completar en tu proyecto.

---

## 1. Resumen

| Capa | Qué hace |
|------|----------|
| **PostgreSQL** | Tabla `lawyer_notifications` + triggers al aprobar cuenta, al crear caso o lead. Tabla `push_tokens` para tokens Expo por usuario. |
| **App móvil** | Lista in-app, badge de no leídas, modal al pulsar la campana; registro de token push en el dashboard del abogado. |
| **Edge Function** | `send-expo-push` llama a la API de Expo Push cuando el webhook dispara tras un INSERT en `lawyer_notifications`. |

---

## 2. Base de datos (Supabase)

### 2.1 Migraciones relevantes

| Archivo | Contenido |
|---------|-----------|
| `supabase/migrations/20260329120000_lawyer_notifications.sql` | Tabla `lawyer_notifications`, RLS (lectura/actualización solo del propio abogado), triggers desde `profiles` (verificación), `cases` y `leads`. |
| `supabase/migrations/20260329140000_push_tokens.sql` | Tabla `push_tokens` (`user_id`, `expo_push_token`, `platform`, …), RLS por usuario. |

El script manual **`supabase/EJECUTAR_EN_SUPABASE.sql`** incluye bloques equivalentes (notificaciones + push tokens) para ejecutar todo junto en el SQL Editor si no usas `supabase db push`.

### 2.2 Eventos que crean filas in-app

- **Cuenta aprobada:** `profiles` pasa `is_verified` de falso a verdadero con `role = 'lawyer'`.
- **Nueva solicitud de caso:** `INSERT` en `public.cases`.
- **Nuevo lead / contacto:** `INSERT` en `public.leads`.

Tipos en `lawyer_notifications.type`: `account_approved`, `new_case`, `new_lead`.

---

## 3. App móvil (`mobile/`)

### 3.1 Archivos principales

| Ruta | Rol |
|------|-----|
| `src/lib/lawyerNotifications.ts` | Consultas a `lawyer_notifications`, conteo no leídas, marcar leída(s). |
| `src/hooks/useLawyerNotifications.ts` | Estado y acciones para el modal. |
| `src/components/LawyerNotificationsModal.tsx` | Modal de lista y “Marcar leídas”. |
| `src/components/LawyerNotificationBell.tsx` | Icono campana + badge (reutilizable). |
| `src/lib/pushNotifications.ts` | Handler de notificaciones, permisos, token Expo, `upsert` en `push_tokens`. |
| `App.tsx` | Import del módulo de push para registrar el handler al inicio. |
| `src/screens/LawyerDashboardScreen.tsx` | Campana en **Casos**, **Leads** y **Perfil**; modal; `registerAndSaveLawyerPushToken` al iniciar sesión como abogado. |
| `src/screens/lawyer/LawyerProfileEditTab.tsx` | Prop opcional `headerRight` (campana en perfil). |
| `app.json` | Plugin `expo-notifications` + `extra.eas.projectId` (necesario para el token Expo). |

### 3.2 Comportamiento UX

- Pull-to-refresh en el dashboard también refresca notificaciones in-app.
- Las push del sistema dependen de token registrado, build nativo y backend configurado (sección 4).

---

## 4. Push: Edge Function y webhook

### 4.1 Código

- **`supabase/functions/send-expo-push/index.ts`**: recibe el cuerpo del webhook (con `record` que incluye `lawyer_id`, `title`, `body`, `type`), busca tokens en `push_tokens` y envía a Expo Push API.

### 4.2 Documentación breve de despliegue

- Ver también **`supabase/functions/README.md`** (sección `send-expo-push`).

### 4.3 Autenticación de la función

- Producción recomendada: secret **`PUSH_WEBHOOK_SECRET`** y cabecera **`x-legalo-webhook-secret`** en el webhook.
- Pruebas: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (no usar nunca en el cliente).

---

## 5. Pasos siguientes (checklist)

Marca en orden lo que aún no hayas hecho.

### Base de datos

- [ ] Aplicar migraciones en tu proyecto Supabase: `supabase db push` **o** ejecutar los bloques correspondientes desde `EJECUTAR_EN_SUPABASE.sql` / migraciones en el SQL Editor.
- [ ] Comprobar que existen tablas `lawyer_notifications` y `push_tokens` y políticas RLS.

### Edge Function de push

- [ ] Crear en Expo un **Access Token** con permiso de Push Notifications (en la cuenta de Expo: *Account settings → Access tokens*). Guía: https://docs.expo.dev/push-notifications/sending-notifications/
- [ ] En Supabase → **Project Settings → Edge Functions → Secrets**, configurar:
  - `EXPO_ACCESS_TOKEN`
  - `PUSH_WEBHOOK_SECRET` (cadena aleatoria larga)
- [ ] Desplegar: `npx supabase functions deploy send-expo-push`

### Webhook (disparar push al crear notificación in-app)

- [ ] Supabase → **Database → Webhooks** → nuevo webhook:
  - Tabla: `lawyer_notifications`
  - Evento: **Insert**
  - URL: `https://<PROJECT_REF>.supabase.co/functions/v1/send-expo-push`
  - Método: **POST**
  - Header: `x-legalo-webhook-secret: <mismo valor que PUSH_WEBHOOK_SECRET>`

### App y builds

- [ ] Variables en `mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ya habituales).
- [ ] Probar push en **dispositivo físico** con build **EAS** (`eas build`). Expo Go y simuladores suelen ser limitados o no válidos para tokens de push reales.
- [ ] Iniciar sesión como abogado verificado, aceptar permisos de notificación y comprobar que aparece una fila en `push_tokens`.

### Pruebas funcionales

- [ ] Aprobar abogado → debe aparecer notificación in-app (y push si webhook + token OK).
- [ ] Cliente crea caso asignado al abogado → misma comprobación.
- [ ] Nuevo lead → misma comprobación.

---

## 6. Solución de problemas

| Síntoma | Qué revisar |
|---------|-------------|
| No hay filas en `lawyer_notifications` | Migración de triggers; que el flujo use las tablas `profiles` / `cases` / `leads` esperadas. |
| In-app vacío pero BD con datos | Usuario logueado = `lawyer_id` de las filas; RLS. |
| Sin push | Token en `push_tokens`, secret `EXPO_ACCESS_TOKEN`, webhook activo, build nativo, permisos del sistema. |
| Error 401 en la función | Cabecera del webhook o `Authorization` incorrectos. |
| Error de Expo al enviar | Token Expo caducado o inválido; revisar respuesta de la API de Expo en logs de la función. |

---

## 7. Archivos de referencia rápida

```
supabase/migrations/20260329120000_lawyer_notifications.sql
supabase/migrations/20260329140000_push_tokens.sql
supabase/functions/send-expo-push/index.ts
supabase/functions/README.md
supabase/EJECUTAR_EN_SUPABASE.sql
mobile/src/lib/lawyerNotifications.ts
mobile/src/lib/pushNotifications.ts
```

Si quieres ampliar (por ejemplo borrar token al cerrar sesión o deep links al abrir una notificación), se puede hacer como iteración sobre esta base.
