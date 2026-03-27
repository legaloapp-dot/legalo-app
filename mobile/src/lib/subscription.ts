import { supabase } from './supabase';

export function planLabelEs(plan: string | null | undefined): string {
  if (plan === 'premium') return 'Premium (suscripción activa)';
  if (plan === 'trial') return 'Periodo de prueba';
  if (plan === 'basic') return 'Plan básico';
  return 'Sin definir';
}

/** Orden en directorio: abogados con suscripción paga primero; luego prueba; basic al final. */
export function directoryPlanSortKey(plan: string | null | undefined): number {
  if (plan === 'premium') return 0;
  if (plan === 'trial') return 1;
  return 2;
}

/** Días naturales hasta la fecha (UTC) o negativo si ya pasó. */
export function calendarDaysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((endDay - nowDay) / 86400000);
}

/** true si debe mostrarse el aviso de fin de prueba (1–5 días restantes). */
export function shouldShowTrialExpiryBanner(
  plan: string | null | undefined,
  expiresAt: string | null | undefined
): boolean {
  if (plan !== 'trial') return false;
  const d = calendarDaysUntil(expiresAt);
  return d != null && d >= 1 && d <= 5;
}

export async function refreshLawyerSubscriptionIfExpired(): Promise<void> {
  const { error } = await supabase.rpc('refresh_lawyer_subscription');
  if (error) throw error;
}

/** Pasa a plan básico (sin prioridad en directorio). La reactivación la gestiona el equipo. */
export async function cancelLawyerSubscription(): Promise<void> {
  const { error } = await supabase.rpc('lawyer_cancel_own_subscription');
  if (error) throw error;
}
