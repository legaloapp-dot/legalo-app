/**
 * Crea un usuario superadmin (rol `admin` en `profiles`) para el panel web.
 * Requiere SUPABASE_SERVICE_ROLE_KEY (y URL) en admin/.env.local o admin/.env
 *
 * Uso:
 *   cd admin && node scripts/create-superadmin.js
 *
 * Opcional en .env:
 *   SUPERADMIN_EMAIL=admin@tu-dominio.com
 *   SUPERADMIN_PASSWORD=TuClaveSegura123!
 *   SUPERADMIN_NAME=Administrador
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv(dir) {
  const file = path.join(dir, ".env.local");
  const file2 = path.join(dir, ".env");
  for (const p of [file, file2]) {
    if (fs.existsSync(p)) {
      fs.readFileSync(p, "utf8")
        .split("\n")
        .forEach((line) => {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
        });
      return;
    }
  }
}

const adminDir = path.join(__dirname, "..");
loadEnv(adminDir);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ Configura en admin/.env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=tu_service_role");
  process.exit(1);
}

const email =
  process.env.SUPERADMIN_EMAIL || "superadmin@legalo.app";
const password =
  process.env.SUPERADMIN_PASSWORD || "Legal0SuperAdmin!";
const fullName =
  process.env.SUPERADMIN_NAME || "Superadmin LÉGALO";

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🔐 Superadmin LÉGALO\n");

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "admin",
      },
    });

  if (createErr) {
    const exists =
      createErr.message?.includes("already") ||
      createErr.message?.includes("registered");
    if (!exists) {
      console.error("❌ Error al crear usuario:", createErr.message);
      process.exit(1);
    }
    console.log("ℹ️  El usuario ya existía en Auth. Actualizando perfil a admin…\n");

    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      console.error("❌", listErr.message);
      process.exit(1);
    }
    const user = list.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      console.error("❌ No se encontró el usuario por email:", email);
      process.exit(1);
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        role: "admin",
        full_name: fullName,
        is_verified: true,
      })
      .eq("id", user.id);

    if (upErr) {
      console.error("❌ Error al actualizar profiles:", upErr.message);
      process.exit(1);
    }
    console.log("✅ Perfil actualizado a rol `admin`.\n");
  } else {
    console.log("✅ Usuario creado en Auth (perfil vía trigger con role admin).\n");
    if (created.user?.id) {
      const { error: patchErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          is_verified: true,
        })
        .eq("id", created.user.id);
      if (patchErr) {
        console.warn("⚠️  Aviso al afinar perfil:", patchErr.message);
      }
    }
  }

  console.log("─────────────────────────────────────");
  console.log("📧 Email:     ", email);
  console.log("🔑 Contraseña:", password);
  console.log("─────────────────────────────────────");
  console.log("\nEntra en el panel: admin → npm run dev → http://localhost:3000/login");
  console.log("Cambia la contraseña en producción y usa variables SUPERADMIN_* en .env\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
