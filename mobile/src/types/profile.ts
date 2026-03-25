export type UserRole = 'client' | 'lawyer' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  is_verified: boolean;
  specialty: string | null;
  specialty_other: string | null;
  inpre_number: string | null;
  lawyer_inpre_card_path: string | null;
  lawyer_cedula_path: string | null;
  years_experience: number | null;
  professional_bio: string | null;
  lawyer_onboarding_step: number | null;
  accepting_cases: boolean | null;
  professional_rating: number | null;
  created_at: string;
}

/** Pasos 1–3: formularios de registro antes de enviar a revisión */
export function lawyerNeedsOnboarding(profile: Profile | null): boolean {
  if (!profile || profile.role !== 'lawyer') return false;
  const s = profile.lawyer_onboarding_step ?? 0;
  return s >= 1 && s <= 3;
}

/** Paso 4 completado: esperando aprobación del admin (`is_verified`) */
export function lawyerPendingVerification(profile: Profile | null): boolean {
  if (!profile || profile.role !== 'lawyer') return false;
  if (profile.is_verified) return false;
  const s = profile.lawyer_onboarding_step ?? 0;
  return s >= 4;
}
