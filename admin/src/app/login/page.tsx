import Link from "next/link";
import { signInAction } from "@/actions/auth";
import { Scale } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#0b1120] via-[#111a2e] to-indigo-950 lg:flex-row">
      <div className="flex flex-1 flex-col justify-center px-8 py-14 text-white lg:max-w-xl lg:px-14">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/40">
            <Scale className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">LÉGALO</p>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-200/80">
              Panel administrador
            </p>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
          Control total de tu operación legal
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
          Gestiona clientes, verifica abogados y aprueba pagos móviles desde un solo lugar.
        </p>
        <div className="mt-10 hidden gap-3 text-xs text-slate-500 lg:flex">
          <span className="rounded-full bg-white/5 px-3 py-1">Supabase</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Next.js</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Seguro</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f1f4f9] px-6 py-14">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-300/50">
          <h2 className="text-center text-xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Solo cuentas con rol <strong>administrador</strong>
          </p>

          {err ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-800">
              {err === "forbidden"
                ? "Tu cuenta no tiene permisos de administrador."
                : err === "missing"
                  ? "Completa email y contraseña."
                  : decodeURIComponent(err)}
            </div>
          ) : null}

          <form action={signInAction} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none ring-indigo-500/0 transition focus:border-indigo-500 focus:bg-white focus:ring-4"
                placeholder="admin@tu-dominio.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
            >
              Entrar al panel
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            ¿Problemas para entrar? Verifica que tu usuario tenga{" "}
            <code className="rounded bg-slate-100 px-1">role = admin</code> en{" "}
            <code className="rounded bg-slate-100 px-1">profiles</code>.
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">
            <Link href="/" className="text-indigo-600 hover:underline">
              Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
