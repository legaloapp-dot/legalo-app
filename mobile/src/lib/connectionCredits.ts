import { supabase } from './supabase';
import { DEFAULT_FEE_USD } from '../config/mobilePayment';

export async function hasOpenConnectionCreditForLawyer(
  clientId: string,
  lawyerId: string
): Promise<boolean> {
  const { data: lawyer, error: e1 } = await supabase
    .from('profiles')
    .select('specialty')
    .eq('id', lawyerId)
    .maybeSingle();
  if (e1 || !lawyer?.specialty) return false;
  const spec = String(lawyer.specialty).trim();
  const { data, error } = await supabase
    .from('connection_credits')
    .select('id')
    .eq('client_id', clientId)
    .eq('specialty', spec)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

export async function consumeConnectionCreditForLawyer(
  clientId: string,
  lawyerId: string
): Promise<boolean> {
  const { data: lawyer } = await supabase
    .from('profiles')
    .select('specialty')
    .eq('id', lawyerId)
    .maybeSingle();
  const spec = (lawyer?.specialty as string | undefined)?.trim();
  if (!spec) return false;
  const { data: row } = await supabase
    .from('connection_credits')
    .select('id')
    .eq('client_id', clientId)
    .eq('specialty', spec)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!row) return false;
  const { error } = await supabase
    .from('connection_credits')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_for_lawyer_id: lawyerId,
    })
    .eq('id', row.id);
  return !error;
}

export async function claimConnectionCreditForRejectedCase(
  clientId: string,
  caseId: string
): Promise<void> {
  const { data: caseRow } = await supabase
    .from('cases')
    .select('lawyer_id, status, client_id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow || caseRow.client_id !== clientId || caseRow.status !== 'rejected_by_lawyer') {
    throw new Error('Este caso no está rechazado o no te pertenece.');
  }
  const { data: refund } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (refund) throw new Error('Ya solicitaste reembolso para este caso.');
  const { data: existing } = await supabase
    .from('connection_credits')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (existing) throw new Error('Ya tienes un cupón registrado para este caso.');
  const { data: prof } = await supabase
    .from('profiles')
    .select('specialty')
    .eq('id', caseRow.lawyer_id)
    .maybeSingle();
  const spec = (prof?.specialty as string | undefined)?.trim() || 'Otro';
  const { error } = await supabase.from('connection_credits').insert({
    client_id: clientId,
    amount_usd: DEFAULT_FEE_USD,
    specialty: spec,
    source_case_id: caseId,
  });
  if (error) throw error;
}

export async function requestRefundForRejectedCase(clientId: string, caseId: string): Promise<void> {
  const { data: caseRow } = await supabase
    .from('cases')
    .select('status, client_id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow || caseRow.client_id !== clientId || caseRow.status !== 'rejected_by_lawyer') {
    throw new Error('Este caso no está rechazado o no te pertenece.');
  }
  const { data: existing } = await supabase
    .from('connection_credits')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (existing) throw new Error('Ya activaste el cupón de conexión para este caso.');
  const { data: refund } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (refund) throw new Error('Ya enviaste una solicitud de reembolso.');
  const { error } = await supabase.from('refund_requests').insert({
    client_id: clientId,
    source_case_id: caseId,
    amount_usd: DEFAULT_FEE_USD,
  });
  if (error) throw error;
}

export async function getCasePostRejectionChoice(
  caseId: string
): Promise<'credit' | 'refund' | null> {
  const { data: c } = await supabase
    .from('connection_credits')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (c) return 'credit';
  const { data: r } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('source_case_id', caseId)
    .maybeSingle();
  if (r) return 'refund';
  return null;
}
