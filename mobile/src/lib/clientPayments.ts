import { supabase } from './supabase';

export async function getLatestTransactionForPair(
  clientId: string,
  lawyerId: string
): Promise<{
  id: string;
  status: string;
  receipt_url: string | null;
  amount: unknown;
  created_at: string;
} | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, status, receipt_url, amount, created_at')
    .eq('client_id', clientId)
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function hasPendingTransaction(clientId: string, lawyerId: string): Promise<boolean> {
  const row = await getLatestTransactionForPair(clientId, lawyerId);
  return row?.status === 'pending';
}

export async function uploadReceiptAndCreateTransaction(
  clientId: string,
  lawyerId: string,
  amountUsd: number,
  localUri: string,
  mimeType: string | undefined
): Promise<void> {
  const ext =
    mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const path = `${clientId}/${lawyerId}-${Date.now()}.${ext}`;
  const res = await fetch(localUri);
  const blob = await res.blob();
  const { error: uErr } = await supabase.storage.from('receipts').upload(path, blob, {
    contentType: mimeType || 'image/jpeg',
    cacheControl: '3600',
  });
  if (uErr) throw uErr;

  const { error: tErr } = await supabase.from('transactions').insert({
    client_id: clientId,
    lawyer_id: lawyerId,
    amount: amountUsd,
    status: 'pending',
    receipt_url: path,
  });
  if (tErr) throw tErr;
}
