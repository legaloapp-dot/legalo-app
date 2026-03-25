import { AdminHeader } from "@/components/layout/AdminHeader";
import { getDashboardStats } from "@/actions/dashboard";
import { Users, Scale, CreditCard, UserCheck } from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    {
      label: "Clientes registrados",
      value: stats.clients,
      icon: Users,
      tone: "bg-sky-500/10 text-sky-700 ring-sky-500/20",
    },
    {
      label: "Abogados",
      value: stats.lawyers,
      icon: Scale,
      tone: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
    },
    {
      label: "Pagos por revisar",
      value: stats.pendingPayments,
      icon: CreditCard,
      tone: "bg-amber-500/10 text-amber-800 ring-amber-500/20",
    },
    {
      label: "Abogados sin verificar",
      value: stats.lawyersPendingVerify,
      icon: UserCheck,
      tone: "bg-rose-500/10 text-rose-800 ring-rose-500/20",
    },
  ];

  return (
    <>
      <AdminHeader
        title="Resumen"
        description="Vista general de la plataforma LÉGALO."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className={`flex flex-col rounded-2xl border p-5 shadow-sm ring-1 ${tone}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {label}
              </span>
              <Icon className="h-5 w-5 opacity-70" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Bienvenido al panel</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Usa el menú lateral para administrar <strong>clientes</strong>, <strong>abogados</strong>{" "}
          (incluye verificación y documentos) y <strong>pagos</strong> con comprobantes.
        </p>
      </div>
    </>
  );
}
