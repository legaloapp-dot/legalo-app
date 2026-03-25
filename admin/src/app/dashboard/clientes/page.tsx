import Link from "next/link";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { listClientsWithEmail } from "@/actions/clients";
import { createClientAction, deleteClientAction } from "@/actions/clients";
import { DeleteButton } from "@/components/DeleteButton";
import { Pencil } from "lucide-react";

export default async function ClientesPage() {
  const rows = await listClientsWithEmail();

  return (
    <>
      <AdminHeader
        title="Clientes"
        description="Alta, edición y baja de usuarios con rol cliente."
      />

      <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Nuevo cliente</h2>
        <p className="mt-1 text-sm text-slate-500">
          Se crea el usuario en Auth y el perfil vía trigger (rol client).
        </p>
        <form action={createClientAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            name="phone"
            placeholder="Teléfono"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Crear cliente
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
              <th>Teléfono</th>
              <th>Alta</th>
              <th className="w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No hay clientes.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800">{r.full_name ?? "—"}</td>
                  <td className="font-mono text-xs">{r.email}</td>
                  <td>{r.phone ?? "—"}</td>
                  <td className="text-xs text-slate-500">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("es-VE")
                      : "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/clientes/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                      <DeleteButton
                        label="Eliminar este cliente"
                        id={r.id}
                        action={deleteClientAction}
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
