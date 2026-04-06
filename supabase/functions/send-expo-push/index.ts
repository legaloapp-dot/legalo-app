/**
 * Envía notificación push vía Expo Push API para abogados y clientes.
 * Invocada desde triggers de DB via pg_net (INSERT en lawyer_notifications / client_notifications).
 *
 * Secrets (en Supabase Vault): EXPO_ACCESS_TOKEN, PUSH_WEBHOOK_SECRET.
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son automáticos en Edge Functions.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotificationRecord = {
  user_id: string;
  title: string;
  body: string;
  type?: string;
};

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-legalo-webhook-secret',
  };
}

async function getSecret(
  supabase: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  // Primero intenta Deno.env (secreto configurado en Dashboard), luego vault
  const env = Deno.env.get(name);
  if (env) return env;
  const { data } = await supabase
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', name)
    .maybeSingle();
  return (data as { decrypted_secret?: string } | null)?.decrypted_secret ?? null;
}

async function verifyRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (serviceRole && auth === `Bearer ${serviceRole}`) return true;

  const secret = await getSecret(supabase, 'PUSH_WEBHOOK_SECRET');
  const sent =
    req.headers.get('x-legalo-webhook-secret') ?? req.headers.get('x-webhook-secret') ?? '';
  if (secret && sent === secret) return true;

  return false;
}

function extractRecord(body: Record<string, unknown>): NotificationRecord | null {
  const rec = (body.record ?? body) as Record<string, unknown>;
  const userId =
    typeof rec.user_id === 'string' ? rec.user_id
    : typeof rec.lawyer_id === 'string' ? rec.lawyer_id
    : typeof rec.client_id === 'string' ? rec.client_id
    : null;
  if (!userId) return null;
  return {
    user_id: userId,
    title: typeof rec.title === 'string' ? rec.title : 'LÉGALO',
    body: typeof rec.body === 'string' ? rec.body : '',
    type: typeof rec.type === 'string' ? rec.type : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase env missing' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  if (!(await verifyRequest(req, supabase))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const expoToken = await getSecret(supabase, 'EXPO_ACCESS_TOKEN');
  if (!expoToken) {
    console.error('EXPO_ACCESS_TOKEN no configurado');
    return new Response(JSON.stringify({ error: 'EXPO_ACCESS_TOKEN no configurado' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const record = extractRecord(body);
  if (!record) {
    return new Response(JSON.stringify({ error: 'Missing user_id/lawyer_id/client_id', sent: 0 }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const { data: rows, error: qErr } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', record.user_id);

  if (qErr) {
    console.error('push_tokens query', qErr);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const tokens = (rows ?? [])
    .map((r: { expo_push_token: string }) => r.expo_push_token)
    .filter(Boolean);
  if (tokens.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, message: 'Sin tokens para este usuario' }),
      { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
    );
  }

  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title: record.title,
    body: record.body || ' ',
    data: record.type ? { type: record.type } : {},
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${expoToken}`,
    },
    body: JSON.stringify(messages),
  });

  const expoJson = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Expo push error', res.status, expoJson);
    return new Response(
      JSON.stringify({ error: 'Expo API error', status: res.status, details: expoJson }),
      { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, sent: tokens.length, expo: expoJson }),
    { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
  );
});
