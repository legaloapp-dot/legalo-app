export type UserRole = 'client' | 'lawyer' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  /** URL pública de la foto (Storage bucket `avatars`) */
  avatar_url?: string | null;
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
  /** Consultorio: coordenadas y texto para directorio / cercanía */
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  /** trial | premium | basic — null en clientes */
  plan?: string | null;
  subscription_expires_at?: string | null;
  /** Último pago de suscripción (registrado por admin) */
  subscription_paid_at?: string | null;
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
