/**
 * Ejecuta el SQL en Supabase (conexión directa PostgreSQL)
 * Requiere: DATABASE_URL en .env (Project Settings → Database → Connection string)
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Cargar .env de mobile o root
const envPaths = [
  path.join(__dirname, '..', 'mobile', '.env'),
  path.join(__dirname, '..', '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
  }
}

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('❌ Falta DATABASE_URL. Añade en mobile/.env:');
  console.error('   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.qufazyzesquubkmrhyfk.supabase.co:5432/postgres');
  console.error('   Obtén la contraseña en: Supabase Dashboard → Project Settings → Database');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, 'EJECUTAR_EN_SUPABASE.sql'), 'utf8');

async function run() {
  const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
  try {
    await client.connect();
    console.log('🔌 Conectado a Supabase...');
    await client.query(sql);
    console.log('✅ Tablas y políticas creadas correctamente');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
