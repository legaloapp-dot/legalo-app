# Edge Functions - LÉGALO

## legal-chat

Edge Function que integra Gemini para diagnóstico legal venezolano.

### System Prompt configurado

```
Actúa como LÉGALO AI, el asistente legal experto de LÉGALO APP.

Tu Misión: Ayudar a ciudadanos venezolanos a entender su situación legal y conectarlos con abogados humanos verificados.

Tus Reglas de Oro:
- Contexto Local: Usa terminología legal venezolana (LPH, Registro Inmobiliario, Inspectoría del Trabajo, LOPNA).
- Empatía y Claridad: Explica términos complejos de forma sencilla.
- Limitación de Responsabilidad: Siempre incluye la frase de orientación informativa.
- Clasificación Silenciosa: CATEGORIA: [Laboral/Civil/Penal/Mercantil/Familia].

Tu Conocimiento: Constitución de la RBV, Código Civil, Código de Comercio, LOTTT y Ley de Arrendamientos.
```

### Configuración

1. **Secrets en Supabase:**
   - Dashboard → Project Settings → Edge Functions → Secrets
   - Añadir: `GEMINI_API_KEY` = tu API key de [Google AI Studio](https://aistudio.google.com/apikey)

2. **Desplegar:**
   ```bash
   npx supabase functions deploy legal-chat
   ```

3. **URL:** `https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/legal-chat`

### Request

```json
POST /functions/v1/legal-chat
Content-Type: application/json

{
  "message": "Mi jefe me despidió sin causa..."
}
```

### Response

```json
{
  "response": "Texto de la respuesta de Gemini...",
  "category": "Laboral"
}
```

---

## send-expo-push

Envía notificaciones push al abogado cuando se inserta una fila en `lawyer_notifications` (tras aplicar la migración `push_tokens` y registrar el token desde la app).

### Secrets (Supabase → Edge Functions → Secrets)

- `EXPO_ACCESS_TOKEN`: token de [Expo](https://expo.dev/accounts/[tu-cuenta]/settings/access-tokens) (Push Notifications).
- `PUSH_WEBHOOK_SECRET`: cadena aleatoria; el webhook de la base la enviará en la cabecera `x-legalo-webhook-secret`.
- Alternativa para pruebas: llamar la función con `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (no exponer en cliente).

### Desplegar

```bash
npx supabase functions deploy send-expo-push
```

### Database Webhook

1. Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. Tabla: `lawyer_notifications`, evento: **Insert**.
3. URL: `https://<PROJECT_REF>.supabase.co/functions/v1/send-expo-push`.
4. HTTP Headers: `x-legalo-webhook-secret: <mismo valor que PUSH_WEBHOOK_SECRET>`.
5. Método: **POST**.

Con eso, cada notificación in-app también dispara el envío por Expo Push a los dispositivos con token en `push_tokens`.
