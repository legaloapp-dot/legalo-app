import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/layout/AdminHeader";
import {
  getLawyerById,
  updateLawyerAction,
  updateLawyerSubscriptionAction,
  listLawyerSubscriptionPayments,
  registerLawyerSubscriptionPaymentAction,
} from "@/actions/lawyers";
import { LawyerVerificationActions } from "@/components/LawyerVerificationActions";
import { getLawyerVerificationDisplay } from "@/lib/lawyerVerificationDisplay";
import { ArrowLeft } from "lucide-react";

export default async function AbogadoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLawyerById(id);
  if (!data) notFound();
  const { profile, email, inpreUrl, cedulaUrl } = data;
  let subscriptionPayments: Awaited<ReturnType<typeof listLawyerSubscriptionPayments>> = [];
  try {
    subscriptionPayments = await listLawyerSubscriptionPayments(id);
  } catch {
    subscriptionPayments = [];
  }
  const sub = profile as {
    plan?: string | null;
    subscription_expires_at?: string | null;
    subscription_paid_at?: string | null;
  };
  const verificationUi = getLawyerVerificationDisplay({
    is_verified: profile.is_verified,
    lawyer_onboarding_step: profile.lawyer_onboarding_step ?? null,
    lawyer_verification_rejected_at:
      (profile as { lawyer_verification_rejected_at?: string | null }).lawyer_verification_rejected_at ??
      null,
  });

  return (
    <>
      <Link
        href="/dashboard/abogados"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a abogados
      </Link>

      <AdminHeader
        title={profile.full_name ?? "Abogado"}
        description={`${email} · ${verificationUi.label}`}
      />

      <div className="mb-8 max-w-xl">
        <LawyerVerificationActions
          lawyerId={profile.id}
          isVerified={!!profile.is_verified}
          lawyerOnboardingStep={profile.lawyer_onboarding_step ?? null}
          lawyerVerificationRejectedAt={
            (profile as { lawyer_verification_rejected_at?: string | null }).lawyer_verification_rejected_at ??
            null
          }
        />
      </div>

      <div className="mb-8 max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Suscripción</h2>
        <p className="mt-1 text-sm text-slate-500">
          Asigna el plan, la fecha de fin de vigencia y la fecha del último pago registrado.
        </p>
        <form action={updateLawyerSubscriptionAction} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={profile.id} />
          <div>
            <label htmlFor="plan" className="mb-1 block text-xs font-semibold text-slate-600">
              Plan
            </label>
            <select
              id="plan"
              name="plan"
              defaultValue={sub.plan ?? "basic"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="trial">Periodo de prueba</option>
              <option value="premium">Premium (suscripción activa / pagó)</option>
              <option value="basic">Básico (sin prioridad en directorio)</option>
            </select>
          </div>
          <div>
            <label htmlFor="subscription_expires_at" className="mb-1 block text-xs font-semibold text-slate-600">
              Fin de vigencia (prueba o suscripción)
            </label>
            <input
              id="subscription_expires_at"
              name="subscription_expires_at"
              type="datetime-local"
              defaultValue={
                sub.subscription_expires_at
                  ? new Date(sub.subscription_expires_at).toISOString().slice(0, 16)
                  : ""
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">Vacío = sin fecha guardada.</p>
          </div>
          <div>
            <label htmlFor="subscription_paid_at" className="mb-1 block text-xs font-semibold text-slate-600">
              Fecha del último pago
            </label>
            <input
              id="subscription_paid_at"
              name="subscription_paid_at"
              type="date"
              defaultValue={sub.subscription_paid_at ? sub.subscription_paid_at.slice(0, 10) : ""}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">Usa los filtros de la lista por este campo.</p>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
          >
            Guardar suscripción
          </button>
        </form>
      </div>

      <div className="mb-8 max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Historial de pagos a la plataforma</h2>
        <p className="mt-1 text-sm text-slate-500">
          Registra pagos confirmados; el abogado los verá en la app (Pagos) con fecha e importe.
        </p>
        <form action={registerLawyerSubscriptionPaymentAction} className="mt-4 flex flex-wrap items-end gap-4 border-b border-slate-100 pb-6">
          <input type="hidden" name="lawyer_id" value={profile.id} />
          <div>
            <label htmlFor="pay_amount" className="mb-1 block text-xs font-semibold text-slate-600">
              Importe
            </label>
            <input
              id="pay_amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="ej. 29.99"
              className="w-36 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="pay_date" className="mb-1 block text-xs font-semibold text-slate-600">
              Fecha del pago
            </label>
            <input
              id="pay_date"
              name="paid_at"
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="pay_desc" className="mb-1 block text-xs font-semibold text-slate-600">
              Concepto (opcional)
            </label>
            <input
              id="pay_desc"
              name="description"
              type="text"
              placeholder="Suscripción mensual LÉGALO"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
          >
            Registrar pago
          </button>
        </form>
        {subscriptionPayments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Sin movimientos registrados.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {subscriptionPayments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-900">
                    {Number(p.amount).toLocaleString("es-VE", {
                      style: "currency",
                      currency: p.currency || "USD",
                    })}
                  </span>
                  <span className="ml-2 text-slate-500">
                    {new Date(p.paid_at).toLocaleDateString("es-VE", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  {p.description ? (
                    <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {p.status === "completed" ? "Completado" : p.status === "pending" ? "Pendiente" : "Reembolsado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Documentos enviados</h2>
            <p className="mt-1 text-sm text-slate-500">
              Archivos en el bucket <code className="rounded bg-slate-100 px-1">lawyer-cards</code>
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Carnet INPRE</p>
                {inpreUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inpreUrl}
                    alt="INPRE"
                    className="max-h-56 w-full rounded-xl border border-slate-200 object-contain"
                  />
                ) : (
                  <p className="text-sm text-slate-400">Sin archivo</p>
                )}
                <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                  {profile.lawyer_inpre_card_path ?? "—"}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Cédula</p>
                {cedulaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cedulaUrl}
                    alt="Cédula"
                    className="max-h-56 w-full rounded-xl border border-slate-200 object-contain"
                  />
                ) : (
                  <p className="text-sm text-slate-400">Sin archivo</p>
                )}
                <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                  {profile.lawyer_cedula_path ?? "—"}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Datos del perfil</h2>
          <form action={updateLawyerAction} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={profile.id} />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Correo</label>
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-500">
                {email}
              </p>
            </div>
            <div>
              <label htmlFor="full_name" className="mb-1 block text-xs font-semibold text-slate-600">
                Nombre
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
            <div>
              <label htmlFor="specialty" className="mb-1 block text-xs font-semibold text-slate-600">
                Especialidad
              </label>
              <input
                id="specialty"
                name="specialty"
                defaultValue={profile.specialty ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inpre_number" className="mb-1 block text-xs font-semibold text-slate-600">
                Número INPRE
              </label>
              <input
                id="inpre_number"
                name="inpre_number"
                defaultValue={profile.inpre_number ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="professional_bio" className="mb-1 block text-xs font-semibold text-slate-600">
                Bio
              </label>
              <textarea
                id="professional_bio"
                name="professional_bio"
                rows={4}
                defaultValue={profile.professional_bio ?? ""}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="accepting_cases"
                name="accepting_cases"
                type="checkbox"
                defaultChecked={profile.accepting_cases !== false}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="accepting_cases" className="text-sm text-slate-700">
                Acepta nuevos casos
              </label>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Guardar cambios
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
