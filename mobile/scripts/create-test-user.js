/**
 * Crea un usuario de prueba en Supabase
 * Requiere: SUPABASE_SERVICE_ROLE_KEY en mobile/.env
 *
 * Ejecutar: cd mobile && node scripts/create-test-user.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar .env
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
  console.error('   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key');
  console.error('');
  console.error('   Obtén la clave en: Supabase Dashboard → Project Settings → API → service_role');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const TEST_USER = {
  email: 'prueba@legalo.app',
  password: 'Legal0Prueba!',
  full_name: 'Usuario Prueba',
  role: 'client',
};

async function createUser() {
  console.log('🔐 Creando usuario de prueba...\n');
  try {
    const { error } = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER.full_name, role: TEST_USER.role },
    });
    if (error) {
      if (error.message.includes('already been registered')) {
        console.log('⚠️  El usuario ya existe. Usa estas credenciales:\n');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Usuario creado correctamente.\n');
    }
    console.log('📧 Email:', TEST_USER.email);
    console.log('🔑 Contraseña:', TEST_USER.password);
    console.log('\nUsa estas credenciales en la app para iniciar sesión.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createUser();
