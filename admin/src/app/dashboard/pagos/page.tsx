import { AdminHeader } from "@/components/layout/AdminHeader";
import {
  listTransactionsEnriched,
  setTransactionStatusAction,
} from "@/actions/payments";
import { Check, X, Clock } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <Check className="h-3 w-3" /> Aprobado
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        <X className="h-3 w-3" /> Rechazado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  );
}

export default async function PagosPage() {
  const rows = await listTransactionsEnriched();

  return (
    <>
      <AdminHeader
        title="Pagos"
        description="Comprobantes de pago móvil: aprueba o rechaza para desbloquear el contacto con el abogado."
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="admin-table text-xs lg:text-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Email</th>
              <th>Abogado</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Comprobante</th>
              <th className="min-w-[200px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  No hay transacciones.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap text-slate-500">
                    {new Date(t.created_at).toLocaleString("es-VE")}
                  </td>
                  <td className="font-medium">{t.client_name ?? "—"}</td>
                  <td className="max-w-[140px] truncate font-mono text-[11px]">{t.client_email}</td>
                  <td>{t.lawyer_name ?? "—"}</td>
                  <td className="tabular-nums">
                    {t.amount != null ? `USD ${Number(t.amount).toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>
                    {t.receipt_signed_url ? (
                      <a
                        href={t.receipt_signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        Ver imagen
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <form action={setTransactionStatusAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                        >
                          Aprobar
                        </button>
                      </form>
                      <form action={setTransactionStatusAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100"
                        >
                          Rechazar
                        </button>
                      </form>
                      <form action={setTransactionStatusAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value="pending" />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Pendiente
                        </button>
                      </form>
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
