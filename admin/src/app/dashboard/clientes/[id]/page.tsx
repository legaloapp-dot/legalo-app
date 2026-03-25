import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { getClientById, updateClientAction } from "@/actions/clients";
import { ArrowLeft } from "lucide-react";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientById(id);
  if (!data) notFound();
  const { profile, email } = data;

  return (
    <>
      <Link
        href="/dashboard/clientes"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>
      <AdminHeader title="Editar cliente" description={email} />

      <div className="max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <form action={updateClientAction} className="space-y-4">
          <input type="hidden" name="id" value={profile.id} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Correo</label>
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-500">
              {email}
            </p>
          </div>
          <div>
            <label htmlFor="full_name" className="mb-1 block text-xs font-semibold text-slate-600">
              Nombre completo
            </label>
            <input
              id="full_name"
              name="full_name"
              defaultValue={profile.full_name ?? ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-slate-600">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={profile.phone ?? ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
          >
            Guardar cambios
          </button>
        </form>
      </div>
    </>
  );
}
