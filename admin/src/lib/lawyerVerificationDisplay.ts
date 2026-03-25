/** Etiqueta de verificación de abogado para listado y detalle (admin). */

export type LawyerVerificationVariant = "success" | "warning" | "danger" | "muted";

export type LawyerVerificationDisplay = {
  label: string;
  description: string;
  variant: LawyerVerificationVariant;
};

export function getLawyerVerificationDisplay(p: {
  is_verified: boolean | null;
  lawyer_onboarding_step: number | null;
  lawyer_verification_rejected_at?: string | null;
}): LawyerVerificationDisplay {
  if (p.is_verified) {
    return {
      label: "Aprobado",
      description: "Verificación aceptada; el abogado cuenta como verificado en la app.",
      variant: "success",
    };
  }
  if (p.lawyer_verification_rejected_at) {
    return {
      label: "Rechazado",
      description: "La verificación fue rechazada por administración.",
      variant: "danger",
    };
  }
  const step = p.lawyer_onboarding_step ?? 0;
  if (step >= 4) {
    return {
      label: "Pendiente de revisión",
      description: "Envió documentos y espera decisión del administrador.",
      variant: "warning",
    };
  }
  return {
    label: "En trámite",
    description: "Aún no completó el registro o no envió documentos para revisión.",
    variant: "muted",
  };
}

export function variantClasses(v: LawyerVerificationVariant): string {
  switch (v) {
    case "success":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "danger":
      return "bg-rose-50 text-rose-900 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}
