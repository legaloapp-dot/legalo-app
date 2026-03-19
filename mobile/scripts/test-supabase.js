/**
 * Script para probar la conexión a Supabase
 * Ejecutar: node scripts/test-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar .env manualmente
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Faltan variables en .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log('🔌 Probando conexión a Supabase...\n');

  try {
    // 1. Test Auth (siempre disponible)
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    console.log('✅ Auth: Conectado (sesión:', session?.session ? 'activa' : 'ninguna', ')');

    // 2. Test tabla profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profilesError) {
      if (profilesError.code === '42P01') {
        console.log('⚠️  Tabla "profiles": No existe. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.');
      } else {
        console.log('⚠️  Tabla "profiles":', profilesError.message);
      }
    } else {
      console.log('✅ Tabla "profiles": OK (' + (profiles?.length || 0) + ' registros)');
    }

    // 3. Test tabla transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (txError) {
      if (txError.code === '42P01') {
        console.log('⚠️  Tabla "transactions": No existe. Ejecuta supabase/schema.sql en el SQL Editor.');
      } else {
        console.log('⚠️  Tabla "transactions":', txError.message);
      }
    } else {
      console.log('✅ Tabla "transactions": OK (' + (transactions?.length || 0) + ' registros)');
    }

    console.log('\n✅ Conexión a Supabase exitosa');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

testConnection();
