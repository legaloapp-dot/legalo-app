// Edge Function: legal-chat
// Integración con Gemini para diagnóstico legal venezolano

const SYSTEM_PROMPT = `Actúa como LÉGALO AI, el asistente legal experto de LÉGALO APP.

Tu Misión: Ayudar a ciudadanos venezolanos a entender su situación legal y conectarlos con abogados humanos verificados.

Tus Reglas de Oro:

Contexto Local: Usa terminología legal venezolana (Ej: LPH, Registro Inmobiliario, Inspectoría del Trabajo, LOPNA).

Empatía y Claridad: Explica términos complejos de forma sencilla.

Limitación de Responsabilidad: Siempre incluye la frase: 'Esta es una orientación informativa. Para una defensa legal, debes consultar con uno de nuestros abogados verificados'.

Clasificación Silenciosa: Al final de cada diagnóstico, genera un bloque JSON invisible (o estructurado) que diga: CATEGORIA: [Laboral/Civil/Penal/Mercantil/Familia].

Tu Conocimiento: Constitución de la RBV, Código Civil, Código de Comercio, LOTTT y Ley de Arrendamientos.`;

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface FileAttachment {
  base64: string;
  mimeType: string;
}

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>;
  // Legacy single-image format (backward compatible)
  base64Image?: string;
  imageMimeType?: string;
  // New multi-file format
  attachments?: FileAttachment[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: { message: string };
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY no configurada');
    return new Response(
      JSON.stringify({
        error:
          'Servicio no configurado. Configura GEMINI_API_KEY en Supabase Secrets.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    let message: string;
    let history: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    let attachments: FileAttachment[] = [];

    try {
      const body = await req.json();
      message = body?.message ?? '';
      history = body?.history ?? [];

      // Support new array format (filter invalid entries)
      if (Array.isArray(body?.attachments)) {
        attachments = body.attachments.filter(
          (a: unknown): a is FileAttachment =>
            typeof a === 'object' &&
            a !== null &&
            typeof (a as FileAttachment).base64 === 'string' &&
            typeof (a as FileAttachment).mimeType === 'string' &&
            (a as FileAttachment).base64.length > 0
        );
      }
      // Backward compatibility: convert legacy single-image to array
      else if (body?.base64Image && body?.imageMimeType) {
        attachments = [
          { base64: body.base64Image, mimeType: body.imageMimeType },
        ];
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Cuerpo JSON inválido' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!message?.trim() && attachments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Mensaje o archivo requerido' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Limitar el historial para no exceder tokens (últimos 10 mensajes)
    const limitedHistory = history.slice(-10);

    const userParts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];
    if (message.trim()) userParts.push({ text: message.trim() });

    // Add all attachments as inlineData parts
    for (const att of attachments) {
      userParts.push({
        inlineData: { mimeType: att.mimeType, data: att.base64 },
      });
    }

    const contents = [...limitedHistory, { role: 'user', parts: userParts }];

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: GeminiResponse = await res.json();

    if (!res.ok) {
      console.error('Gemini API error:', data);
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Error en la API' }),
        {
          status: res.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const category = extractCategory(text);

    return new Response(
      JSON.stringify({
        response: cleanResponseText(text),
        category: category || null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

function cleanResponseText(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, '')
    .replace(/^\s*\{[\s\S]*?\}\s*$/gm, '')
    .replace(/\n*CATEGORIA:\s*\[?[^\]]*\]?\s*/gi, '')
    .trim();
}

function extractCategory(text: string): string | null {
  const categories = [
    'Laboral',
    'Civil',
    'Penal',
    'Mercantil',
    'Administrativo',
    'Familia',
    'Inmobiliario',
    'Inquilinato',
  ];
  // Buscar patrón CATEGORIA: [X] o CATEGORIA: X
  const categoriaMatch = text.match(/CATEGORIA:\s*\[?([^\]\s]+)\]?/i);
  if (categoriaMatch) {
    const found = categories.find(
      (c) => c.toLowerCase() === categoriaMatch[1].toLowerCase()
    );
    if (found) return found;
  }
  // Fallback: buscar por palabra clave en el texto
  const lower = text.toLowerCase();
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  return null;
}
