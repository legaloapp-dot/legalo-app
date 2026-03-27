import { supabase } from './supabase';

export type SubscriptionHistoryRow = {
  key: string;
  amount: number;
  currency: string;
  /** Fecha mostrada: creación del pago o fecha de registro */
  dateIso: string;
  description: string | null;
  /** Estado unificado para la UI */
  uiStatus: 'pending' | 'approved' | 'rejected' | 'completed' | 'refunded';
};

function mapTxStatus(s: string): SubscriptionHistoryRow['uiStatus'] {
  if (s === 'pending') return 'pending';
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

function mapLedgerStatus(s: string): SubscriptionHistoryRow['uiStatus'] {
  if (s === 'completed') return 'completed';
  if (s === 'pending') return 'pending';
  if (s === 'refunded') return 'refunded';
  return 'completed';
}

/** Historial: transacciones de suscripción (app) + registros manuales en admin sin transacción. */
export async function fetchLawyerSubscriptionHistory(lawyerId: string): Promise<SubscriptionHistoryRow[]> {
  const [txRes, ledRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, status, created_at, purpose')
      .eq('client_id', lawyerId)
      .eq('purpose', 'lawyer_subscription')
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('lawyer_subscription_payments')
      .select('id, amount, currency, paid_at, description, status, transaction_id')
      .eq('lawyer_id', lawyerId)
      .is('transaction_id', null)
      .order('paid_at', { ascending: false })
      .limit(80),
  ]);

  if (txRes.error) throw txRes.error;
  if (ledRes.error) throw ledRes.error;

  const fromTx: SubscriptionHistoryRow[] = (txRes.data ?? []).map((row: Record<string, unknown>) => ({
    key: `tx-${row.id}`,
    amount: Number(row.amount ?? 0),
    currency: 'USD',
    dateIso: String(row.created_at ?? ''),
    description: 'Suscripción Premium (comprobante)',
    uiStatus: mapTxStatus(String(row.status ?? 'pending')),
  }));

  const fromLedger: SubscriptionHistoryRow[] = (ledRes.data ?? []).map((row: Record<string, unknown>) => ({
    key: `led-${row.id}`,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'USD'),
    dateIso: String(row.paid_at ?? ''),
    description: row.description != null ? String(row.description) : null,
    uiStatus: mapLedgerStatus(String(row.status ?? 'completed')),
  }));

  const merged = [...fromTx, ...fromLedger];
  merged.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  return merged;
}
