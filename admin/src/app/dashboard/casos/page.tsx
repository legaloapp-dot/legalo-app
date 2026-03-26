import Link from "next/link";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { listCasesEnriched, createCaseAction, deleteCaseAction } from "@/actions/cases";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/caseConstants";
import { listClientsWithEmail } from "@/actions/clients";
import { listLawyersWithEmail } from "@/actions/lawyers";
import { DeleteButton } from "@/components/DeleteButton";
import { Pencil } from "lucide-react";

export default async function CasosPage() {
  const [rows, clients, lawyers] = await Promise.all([
    listCasesEnriched(),
    listClientsWithEmail(),
    listLawyersWithEmail(),
  ]);

  return (
    <>
      <AdminHeader
        title="Casos"
        description="Alta, edición y baja de casos entre clientes y abogados (tabla cases)."
      />

      <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Nuevo caso</h2>
        <p className="mt-1 text-sm text-slate-500">
          Asigna cliente y abogado, título y estado. Úsalo para correcciones o cargas manuales.
        </p>
        <form action={createCaseAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="new-title" className="mb-1 block text-xs font-semibold text-slate-600">
              Título *
            </label>
            <input
              id="new-title"
              name="title"
              required
              placeholder="Ej. Revisión de contrato"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-client" className="mb-1 block text-xs font-semibold text-slate-600">
              Cliente *
            </label>
            <select
              id="new-client"
              name="client_id"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.full_name ?? "Sin nombre") + ` (${c.email})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-lawyer" className="mb-1 block text-xs font-semibold text-slate-600">
              Abogado *
            </label>
            <select
              id="new-lawyer"
              name="lawyer_id"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.full_name ?? "Sin nombre") + ` (${l.email})`}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-desc" className="mb-1 block text-xs font-semibold text-slate-600">
              Descripción
            </label>
            <textarea
              id="new-desc"
              name="description"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label htmlFor="new-display" className="mb-1 block text-xs font-semibold text-slate-600">
              Nombre visible cliente
            </label>
            <input
              id="new-display"
              name="client_display_name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Opcional (denormalizado para UI)"
            />
          </div>
          <div>
            <label htmlFor="new-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Estado
            </label>
            <select
              id="new-status"
              name="status"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              defaultValue="pending_approval"
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CASE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-activity" className="mb-1 block text-xs font-semibold text-slate-600">
              Última actividad (nota)
            </label>
            <input
              id="new-activity"
              name="last_activity"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Opcional — por defecto: creado desde panel admin"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Crear caso
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="admin-table text-xs lg:text-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Título</th>
              <th>Cliente</th>
              <th>Abogado</th>
              <th>Estado</th>
              <th>Última actividad</th>
              <th className="min-w-[140px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  No hay casos.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-slate-500">
                    {r.created_at ? new Date(r.created_at).toLocaleString("es-VE") : "—"}
                  </td>
                  <td className="max-w-[200px] font-medium text-slate-800">
                    <span className="line-clamp-2">{r.title}</span>
                  </td>
                  <td>{r.client_name ?? "—"}</td>
                  <td>{r.lawyer_name ?? "—"}</td>
                  <td>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {CASE_STATUS_LABELS[r.status as CaseStatus] ?? r.status}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate text-slate-500">
                    {r.last_activity ?? "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/casos/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                      <DeleteButton
                        label="Eliminar este caso"
                        id={r.id}
                        action={deleteCaseAction}
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
