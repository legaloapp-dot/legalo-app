/**
 * Envía notificación push vía Expo Push API cuando hay filas nuevas en lawyer_notifications.
 * Invócala con un Database Webhook (INSERT en public.lawyer_notifications) o manualmente con curl.
 *
 * Secrets: EXPO_ACCESS_TOKEN, PUSH_WEBHOOK_SECRET (opcional pero recomendado), SUPABASE_* (automáticos).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type LawyerNotificationRecord = {
  lawyer_id?: string;
  title?: string;
  body?: string | null;
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

function verify(req: Request): boolean {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (serviceRole && auth === `Bearer ${serviceRole}`) return true;

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const sent =
    req.headers.get('x-legalo-webhook-secret') ?? req.headers.get('x-webhook-secret') ?? '';
  if (secret && sent === secret) return true;

  return false;
}

function extractRecord(body: Record<string, unknown>): LawyerNotificationRecord | null {
  const rec = (body.record ?? body) as Record<string, unknown>;
  const lawyerId = typeof rec.lawyer_id === 'string' ? rec.lawyer_id : null;
  if (!lawyerId) return null;
  return {
    lawyer_id: lawyerId,
    title: typeof rec.title === 'string' ? rec.title : 'LÉGALO',
    body: typeof rec.body === 'string' ? rec.body : rec.body === null ? null : undefined,
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

  if (!verify(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!expoToken) {
    console.error('EXPO_ACCESS_TOKEN no configurado');
    return new Response(JSON.stringify({ error: 'EXPO_ACCESS_TOKEN no configurado en secrets' }), {
      status: 500,
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
  if (!record?.lawyer_id) {
    return new Response(JSON.stringify({ error: 'Missing lawyer_id', sent: 0 }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', record.lawyer_id);

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
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'Sin tokens para este abogado' }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const title = record.title ?? 'LÉGALO';
  const bodyText = record.body ?? '';
  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title,
    body: bodyText || ' ',
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
      { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, sent: tokens.length, expo: expoJson }),
    { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
  );
});
