import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

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
): Promise<string> {
  const ext =
    mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const path = `${clientId}/${lawyerId}-${Date.now()}.${ext}`;
  // RN: fetch(file://...) suele fallar con "Network request failed"; leemos en base64.
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const buffer = base64ToArrayBuffer(base64);
  const { error: uErr } = await supabase.storage.from('receipts').upload(path, buffer, {
    contentType: mimeType || 'image/jpeg',
    cacheControl: '3600',
  });
  if (uErr) throw uErr;

  const { data: row, error: tErr } = await supabase
    .from('transactions')
    .insert({
      client_id: clientId,
      lawyer_id: lawyerId,
      amount: amountUsd,
      status: 'pending',
      receipt_url: path,
    })
    .select('id')
    .single();
  if (tErr) throw tErr;
  if (!row?.id) throw new Error('No se obtuvo el id de la transacción.');
  return row.id as string;
}
