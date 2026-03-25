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
