import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { getLawyerById, updateLawyerAction } from "@/actions/lawyers";
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
