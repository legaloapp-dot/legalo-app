"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLawyerVerificationAction } from "@/actions/lawyers";
import {
  getLawyerVerificationDisplay,
  variantClasses,
} from "@/lib/lawyerVerificationDisplay";
import { ShieldCheck, ShieldOff } from "lucide-react";

type Props = {
  lawyerId: string;
  isVerified: boolean;
  lawyerOnboardingStep: number | null;
  lawyerVerificationRejectedAt: string | null;
};

export function LawyerVerificationActions({
  lawyerId,
  isVerified,
  lawyerOnboardingStep,
  lawyerVerificationRejectedAt,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const display = getLawyerVerificationDisplay({
    is_verified: isVerified,
    lawyer_onboarding_step: lawyerOnboardingStep,
    lawyer_verification_rejected_at: lawyerVerificationRejectedAt,
  });

  const run = (action: "approve" | "reject") => {
    const msg =
      action === "approve"
        ? "¿Confirmar APROBACIÓN?\n\nEl abogado quedará como verificado en la app."
        : "¿Confirmar RECHAZO de la verificación?\n\nQuedará marcado como rechazado (no verificado).";
    if (typeof window !== "undefined" && !window.confirm(msg)) {
      return;
    }
    const fd = new FormData();
    fd.set("id", lawyerId);
    fd.set("verification_action", action);
    startTransition(async () => {
      try {
        await setLawyerVerificationAction(fd);
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border border-slate-200/80 p-4 ring-1 ${variantClasses(display.variant)}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Estado de verificación
        </p>
        <p className="mt-1 text-lg font-bold">{display.label}</p>
        <p className="mt-1 text-sm opacity-90">{display.description}</p>
        {lawyerVerificationRejectedAt && (
          <p className="mt-2 font-mono text-[11px] text-slate-600">
            Rechazo registrado:{" "}
            {new Date(lawyerVerificationRejectedAt).toLocaleString("es-VE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" />
          {pending ? "Guardando…" : "Aprobar verificación"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reject")}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
        >
          <ShieldOff className="h-4 w-4" />
          {pending ? "Guardando…" : "Rechazar verificación"}
        </button>
      </div>
    </div>
  );
}
