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

export async function hasPendingLawyerSubscriptionTransaction(lawyerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('client_id', lawyerId)
    .eq('purpose', 'lawyer_subscription')
    .eq('status', 'pending')
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Mismo bucket y patrón que el pago del cliente; client_id = abogado, lawyer_id null, purpose suscripción. */
export async function uploadReceiptAndCreateLawyerSubscriptionTransaction(
  lawyerId: string,
  amountUsd: number,
  localUri: string,
  mimeType: string | undefined
): Promise<string> {
  const ext =
    mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const path = `${lawyerId}/subscription-${Date.now()}.${ext}`;
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
      client_id: lawyerId,
      lawyer_id: null,
      amount: amountUsd,
      status: 'pending',
      receipt_url: path,
      purpose: 'lawyer_subscription',
    })
    .select('id')
    .single();
  if (tErr) throw tErr;
  if (!row?.id) throw new Error('No se obtuvo el id de la transacción.');
  return row.id as string;
}
