import Link from "next/link";
import { AdminHeader } from "@/components/layout/AdminHeader";
import {
  listLawyersWithEmail,
  createLawyerAction,
  deleteLawyerAction,
} from "@/actions/lawyers";
import { DeleteButton } from "@/components/DeleteButton";
import {
  getLawyerVerificationDisplay,
  variantClasses,
} from "@/lib/lawyerVerificationDisplay";
import { Pencil } from "lucide-react";

function planEs(p: string | null | undefined) {
  if (p === "premium") return "Premium";
  if (p === "trial") return "Prueba";
  if (p === "basic") return "Básico";
  return "—";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default async function AbogadosPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; paid_from?: string; paid_to?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listLawyersWithEmail({
    plan: sp.plan,
    paidFrom: sp.paid_from,
    paidTo: sp.paid_to,
  });

  return (
    <>
      <AdminHeader
        title="Abogados"
        description="Gestiona abogados, suscripción y verificación."
      />

      <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Nuevo abogado</h2>
        <p className="mt-1 text-sm text-slate-500">
          Crea usuario con rol lawyer (onboarding puede completarse luego en la app).
        </p>
        <form action={createLawyerAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Correo *"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Contraseña *"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            name="full_name"
            placeholder="Nombre completo"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            name="specialty"
            placeholder="Especialidad"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            name="phone"
            placeholder="Teléfono"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Crear abogado
            </button>
          </div>
        </form>
      </div>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="plan" className="mb-1 block text-xs font-semibold text-slate-600">
            Plan de suscripción
          </label>
          <select
            id="plan"
            name="plan"
            defaultValue={sp.plan ?? "all"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="trial">Prueba</option>
            <option value="premium">Premium</option>
            <option value="basic">Básico</option>
          </select>
        </div>
        <div>
          <label htmlFor="paid_from" className="mb-1 block text-xs font-semibold text-slate-600">
            Fecha de pago desde
          </label>
          <input
            id="paid_from"
            name="paid_from"
            type="date"
            defaultValue={sp.paid_from ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="paid_to" className="mb-1 block text-xs font-semibold text-slate-600">
            Fecha de pago hasta
          </label>
          <input
            id="paid_to"
            name="paid_to"
            type="date"
            defaultValue={sp.paid_to ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          Filtrar
        </button>
        <Link
          href="/dashboard/abogados"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Limpiar
        </Link>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Especialidad</th>
              <th>Plan</th>
              <th>Prueba / vigencia</th>
              <th>Último pago</th>
              <th>Estado verificación</th>
              <th className="w-44">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  No hay abogados con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800">{r.full_name ?? "—"}</td>
                  <td className="font-mono text-xs">{r.email}</td>
                  <td>{r.specialty ?? "—"}</td>
                  <td className="text-sm font-semibold text-slate-800">{planEs(r.plan as string | null)}</td>
                  <td className="text-xs text-slate-600">
                    {fmtDate((r as { subscription_expires_at?: string | null }).subscription_expires_at)}
                  </td>
                  <td className="text-xs text-slate-600">
                    {fmtDate((r as { subscription_paid_at?: string | null }).subscription_paid_at)}
                  </td>
                  <td>
                    {(() => {
                      const v = getLawyerVerificationDisplay({
                        is_verified: r.is_verified,
                        lawyer_onboarding_step: r.lawyer_onboarding_step ?? null,
                        lawyer_verification_rejected_at:
                          (r as { lawyer_verification_rejected_at?: string | null })
                            .lawyer_verification_rejected_at ?? null,
                      });
                      return (
                        <span
                          className={`inline-flex max-w-[200px] flex-col rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ${variantClasses(v.variant)}`}
                        >
                          <span>{v.label}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/abogados/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Detalle
                      </Link>
                      <DeleteButton
                        label="Eliminar este abogado"
                        id={r.id}
                        action={deleteLawyerAction}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
