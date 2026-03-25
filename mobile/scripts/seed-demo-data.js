/**
 * Datos de demostración: abogado verificado + 2 clientes + casos, leads, actividad e ingresos.
 *
 * Requiere en mobile/.env:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Ejecutar: cd mobile && node scripts/seed-demo-data.js
 * Idempotente: borra filas marcadas [SEED] del mismo abogado y las vuelve a crear.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Añade en mobile/.env:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL=...');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=...');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED = {
  lawyer: {
    email: 'abogado.demo@legalo.app',
    password: 'Legal0Demo!',
    full_name: 'Dra. Ana Demo Verificada',
    role: 'lawyer',
  },
  clients: [
    {
      email: 'cliente.demo1@legalo.app',
      password: 'Legal0Demo!',
      full_name: 'Carlos Pérez (demo)',
      role: 'client',
    },
    {
      email: 'cliente.demo2@legalo.app',
      password: 'Legal0Demo!',
      full_name: 'Laura Gómez (demo)',
      role: 'client',
    },
  ],
};

/** Prefijo ASCII (evita corchetes: en LIKE, [S] es clase de caracteres). */
const SEED_TITLE_PREFIX = 'DEMO: ';
const SEED_RECEIPT = 'seed://legalo-demo';
/** Teléfonos solo de este seed (para borrar leads al re-ejecutar). */
const SEED_LEAD_PHONES = ['+584149998877', '+584126667788'];

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function getOrCreateUser({ email, password, full_name, role }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`   ↪ Ya existe: ${email}`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) throw error;
  console.log(`   ✓ Creado: ${email}`);
  return data.user;
}

async function cleanupSeedForLawyer(lawyerId) {
  const { data: cases } = await supabase
    .from('cases')
    .select('id')
    .eq('lawyer_id', lawyerId)
    .like('title', `${SEED_TITLE_PREFIX}%`);

  const caseIds = (cases ?? []).map((c) => c.id);

  if (caseIds.length) {
    await supabase.from('cases').delete().in('id', caseIds);
  }

  await supabase.from('leads').delete().eq('lawyer_id', lawyerId).in('phone_e164', SEED_LEAD_PHONES);

  await supabase.from('lawyer_activity').delete().eq('lawyer_id', lawyerId).like('title', `${SEED_TITLE_PREFIX}%`);

  await supabase.from('transactions').delete().eq('lawyer_id', lawyerId).like('receipt_url', `${SEED_RECEIPT}%`);
}

async function main() {
  console.log('🌱 Seed de demostración LÉGALO\n');

  const lawyerUser = await getOrCreateUser({ ...SEED.lawyer, password: SEED.lawyer.password });
  const clientUsers = [];
  for (const c of SEED.clients) {
    clientUsers.push(await getOrCreateUser({ ...c, password: c.password }));
  }

  const lawyerId = lawyerUser.id;
  const [c1, c2] = clientUsers.map((u) => u.id);

  const { error: upLawyerErr } = await supabase
    .from('profiles')
    .update({
      full_name: SEED.lawyer.full_name,
      role: 'lawyer',
      is_verified: true,
      lawyer_onboarding_step: 5,
      specialty: 'Laboral',
      phone: '+584141112233',
      accepting_cases: true,
      professional_rating: 4.85,
      years_experience: 12,
      professional_bio: 'Perfil de demostración: laboral y seguridad social (datos seed).',
    })
    .eq('id', lawyerId);

  if (upLawyerErr) throw upLawyerErr;

  for (let i = 0; i < clientUsers.length; i++) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: SEED.clients[i].full_name,
        role: 'client',
        phone: i === 0 ? '+584242223344' : '+584242556677',
      })
      .eq('id', clientUsers[i].id);
    if (error) throw error;
  }

  console.log('\n🧹 Limpiando seeds anteriores del mismo abogado...');
  await cleanupSeedForLawyer(lawyerId);

  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();

  const { error: casesErr } = await supabase.from('cases').insert([
    {
      lawyer_id: lawyerId,
      client_id: c1,
      client_display_name: SEED.clients[0].full_name,
      title: `${SEED_TITLE_PREFIX}Despido sin causa — revisión de finiquito`,
      description: 'Demostración seed.',
      status: 'drafting',
      last_activity: 'Cliente envió carta de despido; pendiente contestación patronal.',
      last_activity_at: daysAgo(2),
    },
    {
      lawyer_id: lawyerId,
      client_id: c2,
      client_display_name: SEED.clients[1].full_name,
      title: `${SEED_TITLE_PREFIX}Reconocimiento de antigüedad`,
      description: null,
      status: 'consulting',
      last_activity: 'Primera reunión agendada; documentos laborales en revisión.',
      last_activity_at: daysAgo(5),
    },
    {
      lawyer_id: lawyerId,
      client_id: c1,
      client_display_name: SEED.clients[0].full_name,
      title: `${SEED_TITLE_PREFIX}Pago de prestaciones (cerrado)`,
      description: null,
      status: 'closed',
      last_activity: 'Caso cerrado con acuerdo homologado.',
      last_activity_at: daysAgo(30),
    },
  ]);
  if (casesErr) throw casesErr;

  const { error: leadsErr } = await supabase.from('leads').insert([
    {
      lawyer_id: lawyerId,
      client_name: 'Pedro Ruiz',
      category: 'Laboral',
      message: 'Consulta DEMO — Necesito orientación por despido verbal.',
      phone_e164: '+584149998877',
      status: 'new',
    },
    {
      lawyer_id: lawyerId,
      client_name: 'Empresa XYZ (contacto)',
      category: 'Mercantil',
      message: 'Mensaje DEMO — revisión de cláusula de no competencia.',
      phone_e164: '+584126667788',
      status: 'contacted',
    },
  ]);
  if (leadsErr) throw leadsErr;

  const { error: actErr } = await supabase.from('lawyer_activity').insert([
    {
      lawyer_id: lawyerId,
      event_type: 'case_update',
      title: `${SEED_TITLE_PREFIX}Actualización de caso`,
      body: 'Se solicitó documentación adicional al cliente demo.',
    },
    {
      lawyer_id: lawyerId,
      event_type: 'lead_view',
      title: `${SEED_TITLE_PREFIX}Nueva solicitud`,
      body: 'Lead laboral pendiente de contacto.',
    },
    {
      lawyer_id: lawyerId,
      event_type: 'system',
      title: `${SEED_TITLE_PREFIX}Recordatorio`,
      body: 'Datos generados por script seed-demo-data.js',
    },
  ]);
  if (actErr) throw actErr;

  const { error: txErr } = await supabase.from('transactions').insert([
    {
      client_id: c1,
      lawyer_id: lawyerId,
      amount: 180,
      status: 'approved',
      receipt_url: `${SEED_RECEIPT}/1`,
      created_at: daysAgo(10),
    },
    {
      client_id: c2,
      lawyer_id: lawyerId,
      amount: 320.5,
      status: 'approved',
      receipt_url: `${SEED_RECEIPT}/2`,
      created_at: daysAgo(3),
    },
    {
      client_id: c1,
      lawyer_id: lawyerId,
      amount: 95,
      status: 'pending',
      receipt_url: `${SEED_RECEIPT}/pending`,
      created_at: daysAgo(1),
    },
  ]);
  if (txErr) throw txErr;

  console.log('\n✅ Seed aplicado.\n');
  console.log('── Abogado (verificado, onboarding completo) ──');
  console.log('   Email:   ', SEED.lawyer.email);
  console.log('   Password:', SEED.lawyer.password);
  console.log('── Clientes (para probar vista cliente / casos vinculados) ──');
  SEED.clients.forEach((c) => {
    console.log(`   ${c.email} / ${c.password}`);
  });
  console.log('\nInicia sesión en la app con el abogado para ver dashboard, casos, leads e ingresos.');
  console.log('Inicia con un cliente para ver “Mis casos” / transacciones según RLS.\n');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
