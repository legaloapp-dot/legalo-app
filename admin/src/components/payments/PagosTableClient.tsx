"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setTransactionStatusAction } from "@/actions/payments";
import type { TransactionRow } from "@/actions/payments";
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

const ACTION_LABELS: Record<
  "approved" | "rejected" | "pending",
  { title: string; body: string; confirm: string }
> = {
  approved: {
    title: "Aprobar pago",
    body: "Se marcará como aprobado y el cliente podrá contactar al abogado según las reglas de la app.",
    confirm: "Aprobar",
  },
  rejected: {
    title: "Rechazar pago",
    body: "Se marcará como rechazado. El cliente deberá enviar un comprobante válido si corresponde.",
    confirm: "Rechazar",
  },
  pending: {
    title: "Dejar pendiente",
    body: "El estado volverá a pendiente de revisión.",
    confirm: "Confirmar",
  },
};

function ConfirmStatusButton({
  transactionId,
  nextStatus,
  className,
  children,
}: {
  transactionId: string;
  nextStatus: "approved" | "rejected" | "pending";
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const copy = ACTION_LABELS[nextStatus];

  const run = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", transactionId);
      fd.set("status", nextStatus);
      await setTransactionStatusAction(fd);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} disabled={pending}>
        {children}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
              {copy.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.body}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={pending}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                  nextStatus === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : nextStatus === "rejected"
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-slate-700 hover:bg-slate-600"
                }`}
              >
                {pending ? "…" : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PagosTableClient({ rows }: { rows: TransactionRow[] }) {
  return (
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
                    <ConfirmStatusButton
                      transactionId={t.id}
                      nextStatus="approved"
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Aprobar
                    </ConfirmStatusButton>
                    <ConfirmStatusButton
                      transactionId={t.id}
                      nextStatus="rejected"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Rechazar
                    </ConfirmStatusButton>
                    <ConfirmStatusButton
                      transactionId={t.id}
                      nextStatus="pending"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Pendiente
                    </ConfirmStatusButton>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
