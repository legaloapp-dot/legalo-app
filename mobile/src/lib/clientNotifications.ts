import { supabase } from './supabase';

export type ClientNotificationType =
  | 'payment_approved'
  | 'payment_rejected'
  | 'connection_coupon'
  | 'case_accepted'
  | 'case_rejected';

export interface ClientNotificationRow {
  id: string;
  client_id: string;
  type: ClientNotificationType;
  title: string;
  body: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchClientNotifications(clientId: string): Promise<ClientNotificationRow[]> {
  const { data, error } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as ClientNotificationRow[];
}

export async function countUnreadClientNotifications(clientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('client_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markClientNotificationRead(
  notificationId: string,
  clientId: string
): Promise<void> {
  const { error } = await supabase
    .from('client_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('client_id', clientId);
  if (error) throw error;
}

export async function markAllClientNotificationsRead(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('client_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('read_at', null);
  if (error) throw error;
}
