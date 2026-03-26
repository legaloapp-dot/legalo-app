import { supabase } from './supabase';

export type LawyerNotificationType = 'account_approved' | 'new_case' | 'new_lead';

export interface LawyerNotificationRow {
  id: string;
  lawyer_id: string;
  type: LawyerNotificationType;
  title: string;
  body: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchLawyerNotifications(lawyerId: string): Promise<LawyerNotificationRow[]> {
  const { data, error } = await supabase
    .from('lawyer_notifications')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as LawyerNotificationRow[];
}

export async function countUnreadLawyerNotifications(lawyerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lawyer_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('lawyer_id', lawyerId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markLawyerNotificationRead(
  notificationId: string,
  lawyerId: string
): Promise<void> {
  const { error } = await supabase
    .from('lawyer_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('lawyer_id', lawyerId);
  if (error) throw error;
}

export async function markAllLawyerNotificationsRead(lawyerId: string): Promise<void> {
  const { error } = await supabase
    .from('lawyer_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('lawyer_id', lawyerId)
    .is('read_at', null);
  if (error) throw error;
}
