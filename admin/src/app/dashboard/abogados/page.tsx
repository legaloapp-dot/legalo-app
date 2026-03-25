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

export default async function AbogadosPage() {
  const rows = await listLawyersWithEmail();

  return (
    <>
      <AdminHeader
        title="Abogados"
        description="Gestiona abogados; el detalle incluye documentos y verificación."
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

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Especialidad</th>
              <th>Estado verificación</th>
              <th className="w-44">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No hay abogados.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800">{r.full_name ?? "—"}</td>
                  <td className="font-mono text-xs">{r.email}</td>
                  <td>{r.specialty ?? "—"}</td>
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
