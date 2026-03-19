/**
 * Ejecuta las migraciones en Supabase via SQL Editor
 * Requiere: conexión directa a PostgreSQL o ejecutar manualmente en Dashboard
 *
 * Opción 1 - Supabase CLI (recomendado):
 *   npx supabase login
 *   npx supabase link --project-ref qufazyzesquubkmrhyfk
 *   npx supabase db push
 *
 * Opción 2 - SQL Editor en Dashboard:
 *   Copia el contenido de migrations/ en orden al SQL Editor
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).sort();

console.log('📋 Migraciones a ejecutar (en orden):\n');
files.forEach((f) => console.log('  -', f));
console.log('\nCopia el contenido de cada archivo al SQL Editor de Supabase.');
console.log('Dashboard: https://supabase.com/dashboard/project/qufazyzesquubkmrhyfk/sql\n');
