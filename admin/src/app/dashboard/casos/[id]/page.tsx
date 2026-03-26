import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { getCaseById, updateCaseAction, deleteCaseAction } from "@/actions/cases";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/caseConstants";
import { listClientsWithEmail } from "@/actions/clients";
import { listLawyersWithEmail } from "@/actions/lawyers";
import { DeleteButton } from "@/components/DeleteButton";
import { ArrowLeft } from "lucide-react";

export default async function EditarCasoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, clients, lawyers] = await Promise.all([
    getCaseById(id),
    listClientsWithEmail(),
    listLawyersWithEmail(),
  ]);
  if (!row) notFound();

  return (
    <>
      <Link
        href="/dashboard/casos"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a casos
      </Link>
      <AdminHeader title="Editar caso" description={row.title} />

      <div className="max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <form action={updateCaseAction} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-semibold text-slate-600">
              Título *
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={row.title}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="client_id" className="mb-1 block text-xs font-semibold text-slate-600">
                Cliente *
              </label>
              <select
                id="client_id"
                name="client_id"
                required
                defaultValue={row.client_id}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.full_name ?? "Sin nombre") + ` (${c.email})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lawyer_id" className="mb-1 block text-xs font-semibold text-slate-600">
                Abogado *
              </label>
              <select
                id="lawyer_id"
                name="lawyer_id"
                required
                defaultValue={row.lawyer_id}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {(l.full_name ?? "Sin nombre") + ` (${l.email})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-semibold text-slate-600">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={row.description ?? ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="client_display_name"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Nombre visible cliente
            </label>
            <input
              id="client_display_name"
              name="client_display_name"
              defaultValue={row.client_display_name ?? ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-semibold text-slate-600">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={row.status}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CASE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="last_activity" className="mb-1 block text-xs font-semibold text-slate-600">
              Última actividad (nota)
            </label>
            <input
              id="last_activity"
              name="last_activity"
              defaultValue={row.last_activity ?? ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Guardar cambios
            </button>
            <DeleteButton label="Eliminar este caso" id={row.id} action={deleteCaseAction} />
          </div>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Al guardar se actualiza la fecha de última actividad. Eliminar un caso puede borrar datos
          vinculados (reembolsos/cupones) según la base de datos.
        </p>
      </div>
    </>
  );
}
