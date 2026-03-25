# LÉGALO APP – Historial del Proyecto

**Última actualización:** 25 de marzo de 2025

---

## 1. Resumen del Proyecto

**LÉGALO APP** es una plataforma legal en Venezuela con IA para diagnóstico legal, Supabase como backend, React Native (Expo) para móvil y Next.js para el panel admin.

**Stack:** React Native (Expo), Next.js, Supabase (Auth, DB, Storage), Gemini API.

---

## 2. Estructura del Proyecto

```
Legalo/
├── mobile/                 # App móvil Expo
│   ├── src/
│   │   ├── screens/        # Login, Register, ClientChat, CreateCase, LawyerDashboard, onboarding abogado, tabs cliente
│   │   ├── components/     # Logo, etc.
│   │   ├── contexts/       # AuthContext
│   │   ├── hooks/          # useLawyerDashboardData
│   │   ├── lib/            # supabase.ts, legalDashboard.ts, format.ts
│   │   └── theme/          # colors.ts
│   ├── scripts/            # create-test-user.js, seed-demo-data.js
│   └── .env                # EXPO_PUBLIC_SUPABASE_* (ver .env.example)
├── admin/                  # Panel admin Next.js
├── supabase/
│   ├── functions/
│   │   └── legal-chat/     # Edge Function con Gemini
│   ├── migrations/         # Esquema completo (preferido: supabase db push)
│   ├── EJECUTAR_EN_SUPABASE.sql  # Script único para SQL Editor (paridad con migraciones)
│   └── config.toml         # verify_jwt = false para legal-chat
└── HISTORIAL_PROYECTO.md   # Este archivo
```

---

## 3. Base de Datos (Supabase)

### Tablas principales
- **profiles:** id, full_name, role (client/lawyer/admin), phone, is_verified, specialty, inpre_number, onboarding abogado, rutas verificación, accepting_cases, professional_rating, created_at
- **transactions:** id, client_id, lawyer_id, amount, status, receipt_url, created_at
- **legal_cases:** casos en modelo “dashboard” (vinculación opcional a cliente)
- **cases:** cartera formal cliente–abogado (título, descripción, estados ampliados); copia inicial desde `legal_cases` donde hay `client_id`
- **leads**, **lawyer_activity:** leads y feed del dashboard abogado

### Migraciones (orden en `supabase/migrations/`)

| Archivo | Contenido |
|---------|-----------|
| `20260319120000_initial_schema.sql` | Tablas base, trigger signup |
| `20260319120001_rls_policies.sql` | RLS profiles y transactions |
| `20260319120002_storage_buckets.sql` | Buckets receipts, lawyer-cards |
| `20260319130000_lawyer_directory_rls.sql` | Clientes ven directorio de abogados |
| `20260324120000_lawyer_onboarding.sql` | Columnas onboarding abogado, `handle_new_user` |
| `20260325120000_lawyer_verification_docs.sql` | Rutas INPRE/cédula en Storage |
| `20260326120000_dashboard_legal_data.sql` | legal_cases, leads, lawyer_activity, trigger pago aprobado |
| `20260327120000_cases_table.sql` | Tabla `cases`, RLS, seed desde legal_cases |

**Recomendado:** `supabase db push` (o migraciones del Dashboard) para entornos nuevos. **`EJECUTAR_EN_SUPABASE.sql`** replica el conjunto anterior para pegar en SQL Editor cuando no uses CLI.

### RLS (resumen)
- Usuarios ven/actualizan su propio perfil; autenticados ven perfiles `role = 'lawyer'` (directorio)
- Clientes ven sus transacciones; abogados las asignadas
- Políticas en `legal_cases`, `leads`, `lawyer_activity`, `cases` según migraciones

---

## 4. Autenticación

### Pantallas
- **LoginScreen** – Login con Supabase
- **RegisterScreen** – Registro con selector de rol (client/lawyer)
- **AuthContext** – Estado de sesión

### Usuario de prueba
- **Email:** `prueba@legalo.app`
- **Contraseña:** `Legal0Prueba!`
- **Rol:** client
- **Script:** `cd mobile && node scripts/create-test-user.js` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env`)

---

## 5. Chat con IA (Edge Function legal-chat)

### Ubicación
`supabase/functions/legal-chat/index.ts`

### Configuración
- **Modelo:** `gemini-2.0-flash` (antes gemini-1.5-flash, ya no disponible)
- **API:** fetch directo a `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- **Secret:** `GEMINI_API_KEY` en Supabase Dashboard → Edge Functions → Secrets

### Funcionalidad
- Recibe `{ message: string }`
- Devuelve `{ response: string, category: string | null }`
- Extrae categoría: Laboral, Civil, Penal, Mercantil, Administrativo, Familia, Inmobiliario, Inquilinato
- System prompt: LÉGALO AI, contexto venezolano, LOTTT, Código Civil, etc.

### Despliegue
```bash
cd c:\Empresa\Legalo
npx supabase functions deploy legal-chat --project-ref qufazyzesquubkmrhyfk --no-verify-jwt
```

### config.toml
`verify_jwt = false` para la función legal-chat (permite llamadas sin JWT en desarrollo).

---

## 6. ClientChatScreen (Vista del Cliente)

### Ubicación
`mobile/src/screens/ClientChatScreen.tsx`

### Funcionalidad
- Chat con LÉGALO AI vía `supabase.functions.invoke('legal-chat', { body: { message } })`
- Mensaje de bienvenida inicial
- Badge "CASO DETECTADO: [categoría]" cuando la IA clasifica
- **Botón VER ABOGADOS** – Busca abogados por categoría en Supabase
- Lista de abogados con nombre, especialidad, teléfono, badge verificado, botón **Contactar** (requiere transacción `approved` con ese abogado; luego modal **CreateCaseScreen** y WhatsApp — ver §13)
- Mapeo categoría → especialidad: Inmobiliario/Inquilinato → ['Inmobiliario', 'Inquilinato']
- Pestañas: **Casos**, **Pagos**, **Perfil** con datos desde Supabase (`ClientCasesTab`, `ClientPaymentsTab`, `ClientProfileTab`)

### Acciones por mensaje con categoría
- VER ABOGADOS (implementado)
- VER ARTÍCULOS (placeholder)
- ESTIMAR MONTO (placeholder)

---

## 7. Directorio de Abogados

### Lógica
- Al pulsar "VER ABOGADOS" se hace `SELECT` en `profiles` con `role = 'lawyer'` y `specialty IN (especialidades de la categoría)`.
- Categorías soportadas: Laboral, Civil, Penal, Mercantil, Administrativo, Familia, Inmobiliario, Inquilinato.

### Crear abogados de prueba
```sql
-- Actualizar perfil existente a abogado
UPDATE public.profiles 
SET role = 'lawyer', specialty = 'Inmobiliario', full_name = 'Dr. Juan Pérez', phone = '+58 412 1234567', is_verified = true
WHERE id = 'uuid-de-usuario';
```

---

## 8. Configuración Actual

### mobile/.env
Copiar desde `mobile/.env.example` y completar:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key_del_dashboard>
```

(No commitear secretos; la anon key es pública en el cliente pero conviene no duplicarla en documentación.)

### Supabase
- **Project ref (ejemplo):** qufazyzesquubkmrhyfk
- **Dashboard:** `https://supabase.com/dashboard/project/<ref>`
- **Edge Functions Secrets:** `GEMINI_API_KEY` (Google AI Studio)

### API Key Gemini
- **Problema reciente:** Cuota gratuita agotada (429). Esperar o habilitar facturación en Google AI Studio.
- **Obtener clave:** https://aistudio.google.com/apikey

---

## 9. Comandos Útiles

```bash
# Iniciar app móvil
cd mobile
npx expo start --port 8084

# Crear usuario de prueba
cd mobile && node scripts/create-test-user.js

# Datos demo (requiere SUPABASE_SERVICE_ROLE_KEY)
cd mobile && npm run seed:demo

# Desplegar Edge Function
cd c:\Empresa\Legalo
npx supabase functions deploy legal-chat --project-ref qufazyzesquubkmrhyfk --no-verify-jwt

# Base de datos (preferido)
cd c:\Empresa\Legalo && npx supabase db push

# Alternativa: SQL manual — pegar supabase/EJECUTAR_EN_SUPABASE.sql en SQL Editor
```

### TypeScript (sanidad local)
```bash
cd mobile && npx tsc --noEmit
```

---

## 10. Pendiente / Próximos Pasos

1. **Chat:** Verificar que responde bien cuando la cuota de Gemini esté disponible.
2. ~~**Botón Contactar:**~~ Flujo implementado: pago verificado → creación de caso (`cases`) → WhatsApp (ver §13).
3. **VER ARTÍCULOS y ESTIMAR MONTO:** Implementar o definir alcance.
4. **Streaming:** Opcional – respuesta palabra por palabra (no implementado).
5. ~~**Matchmaking básico:**~~ Directorio + contacto condicionado a fee verificado + caso creado (ver §13).
6. **Flujo de pago:** Cliente sube comprobante / admin aprueba en panel; la app móvil usa `transactions.status = approved` para desbloquear contacto.
7. ~~**Pantallas cliente (tabs):**~~ Casos, Pagos y Perfil enlazados a Supabase; revisar UX y errores de red en dispositivos reales.
8. **Panel admin:** Validación de abogados y aprobación de pagos (fuera de la app móvil).

---

## 11. Errores Resueltos (Referencia)

- Edge function non-2xx: Se añadió config.toml con verify_jwt=false, mejor manejo de errores.
- Modelo gemini-1.5-flash no encontrado: Actualizado a gemini-2.0-flash.
- API key invalid: Verificada; el problema era el modelo, no la clave.
- Cuota 429: Límite free tier; esperar o habilitar facturación.

---

## 12. Rutas Clave

| Archivo | Descripción |
|---------|-------------|
| `mobile/src/screens/ClientChatScreen.tsx` | Chat principal, directorio abogados |
| `mobile/src/screens/CreateCaseScreen.tsx` | Alta de caso antes de WhatsApp |
| `mobile/src/screens/LoginScreen.tsx` | Login |
| `mobile/src/screens/RegisterScreen.tsx` | Registro |
| `mobile/src/contexts/AuthContext.tsx` | Estado de sesión |
| `mobile/src/lib/supabase.ts` | Cliente Supabase |
| `mobile/src/lib/legalDashboard.ts` | Consultas `cases`, fee aprobado |
| `supabase/functions/legal-chat/index.ts` | Edge Function con Gemini |
| `supabase/config.toml` | Config Edge Functions |
| `supabase/EJECUTAR_EN_SUPABASE.sql` | SQL único para SQL Editor |
| `supabase/migrations/*.sql` | Fuente de verdad del esquema |

---

## 13. Avances recientes (sesiones recientes)

### Producto / MVP
- **Abogado sin wallet en la app:** no hay pestaña de ingresos ni cartera; el fee lo paga el cliente a la app (pago móvil); el administrador verifica el comprobante en el panel. El abogado no ve hitos ni pagos internos en el móvil.
- **Desbloqueo de contacto:** el botón **Contactar** con un abogado solo procede si existe una transacción **`approved`** entre ese cliente y ese abogado (fee verificado). Si no, se informa que el pago está pendiente de verificación.

### Flujo cliente → abogado (Contactar)
1. Con pago aprobado: se abre **`CreateCaseScreen`** (modal) para registrar el caso en la tabla **`cases`**: `title`, `description`, `status: 'active'`, `client_id`, `lawyer_id`, `client_display_name`.
2. Tras guardar en Supabase, se abre **WhatsApp** con el mensaje:  
   `Hola Abogado, te contacto por el caso: [Título] en LÉGALO APP` (texto codificado en la URL de `wa.me`).

### Base de datos
- Tabla **`cases`** (migración `20260327120000_cases_table.sql`): estados incl. `active`, `in_court`, `pending`, `closed`, `drafting`, `consulting`, `paid`; RLS para abogado (gestión propia) y cliente (lectura/insert/update propios).
- Copia inicial desde **`legal_cases`** hacia `cases` donde `client_id` no es nulo (`ON CONFLICT DO NOTHING`).
- Migraciones del dashboard: `legal_cases`, `leads`, `lawyer_activity`, columnas en `profiles` (`accepting_cases`, `professional_rating`), trigger de actividad al aprobar transacción.

### App móvil (archivos relevantes)
- `mobile/src/screens/CreateCaseScreen.tsx` — formulario de caso antes del WhatsApp.
- `mobile/src/screens/ClientChatScreen.tsx` — comprobación de pago aprobado + modal de creación de caso.
- `mobile/src/lib/legalDashboard.ts` — consultas a **`cases`**; `hasApprovedFeeForLawyer(clientId, lawyerId)`.
- `mobile/src/screens/LawyerDashboardScreen.tsx` — dashboard sin pestaña Ingresos; métricas reducidas (casos activos + valoración); listado de casos con nombre de cliente cuando existe `client_display_name`.
- Eliminado `LawyerEarningsPanel.tsx`.
- `mobile/src/hooks/useLawyerDashboardData.ts` — ya no carga transacciones para métricas del abogado.

### Seeds y pruebas
- `mobile/scripts/seed-demo-data.js` — abogado verificado + clientes demo + filas en **`cases`** (prefijo `DEMO:`), leads, actividad, transacciones de prueba. Comando: `cd mobile && npm run seed:demo` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env`).
- `mobile/.env.example` — documentada la service role para scripts.

### Supabase (operaciones)
- Proyecto vinculado con CLI; **`supabase db push`** aplicó migraciones pendientes; en entornos con esquema ya creado manualmente se usó **`supabase migration repair`** para marcar migraciones iniciales como aplicadas sin re-ejecutarlas.
- Ajuste en migración de dashboard: `uuid_generate_v4()` sustituido por **`gen_random_uuid()`** donde la extensión no estaba disponible en el contexto remoto.
- `supabase/config.toml`: `major_version` alineado con la base remota (17).

### Verificación técnica (código)
- **`CreateCaseScreen`** está montado en `ClientChatScreen` (modal cuando hay abogado elegido y pago aprobado); `onCaseCreated` cierra el modal y abre WhatsApp con el título del caso.
- Tipado: `openWhatsAppWithCaseTitle` usa `CreateCaseLawyer` (exportado desde `CreateCaseScreen`).

### Script SQL manual
- **`EJECUTAR_EN_SUPABASE.sql`** incluye, en orden: esquema base, onboarding, verificación docs, **dashboard** (`legal_cases`, `leads`, `lawyer_activity`, trigger de pago) y tabla **`cases`** con RLS y copia desde `legal_cases`. Mantener alineado con las migraciones al añadir cambios.

### Pendiente aún (recordatorio)
- Panel admin: verificación de pagos y abogados fuera del alcance de la app móvil descrito arriba.
- Ejecutar en local `cd mobile && npx tsc --noEmit` tras cambios relevantes en tipos.

---

*Documento generado para continuar el desarrollo. Revisar este historial antes de seguir trabajando.*
