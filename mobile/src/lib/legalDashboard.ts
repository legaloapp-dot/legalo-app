import { supabase } from './supabase';

export type LegalCaseStatus =
  | 'pending_approval'
  | 'rejected_by_lawyer'
  | 'active'
  | 'in_court'
  | 'pending'
  | 'closed'
  | 'drafting'
  | 'consulting'
  | 'paid';

export interface LegalCaseRow {
  id: string;
  lawyer_id: string;
  client_id: string;
  title: string;
  description: string | null;
  client_display_name: string | null;
  status: LegalCaseStatus;
  last_activity: string | null;
  last_activity_at: string | null;
  created_at: string;
}

export interface LeadRow {
  id: string;
  lawyer_id: string;
  client_name: string;
  category: string | null;
  message: string | null;
  phone_e164: string;
  status: 'new' | 'contacted' | 'dismissed';
  created_at: string;
}

export interface LawyerActivityRow {
  id: string;
  lawyer_id: string;
  event_type: 'review' | 'payment' | 'lead_view' | 'case_update' | 'system';
  title: string;
  body: string | null;
  created_at: string;
}

/** Tabla `cases` ausente o no expuesta (proyectos con solo migración 11 y `legal_cases`). */
function isCasesTableUnavailable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'PGRST205') return true;
  const m = (err.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('cases') && m.includes('does not exist'))
  );
}

/** Fila antigua `legal_cases` → forma unificada `LegalCaseRow`. */
function mapLegacyLegalCaseRow(row: Record<string, unknown>): LegalCaseRow {
  return {
    id: String(row.id),
    lawyer_id: row.lawyer_id != null ? String(row.lawyer_id) : '',
    client_id: row.client_id != null ? String(row.client_id) : '',
    title: String(row.title ?? ''),
    description: null,
    client_display_name: null,
    status: row.status as LegalCaseStatus,
    last_activity: row.last_activity != null ? String(row.last_activity) : null,
    last_activity_at: row.last_activity_at != null ? String(row.last_activity_at) : null,
    created_at: String(row.created_at ?? ''),
  };
}

export async function fetchLawyerCases(lawyerId: string): Promise<LegalCaseRow[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (!error) {
    return (data ?? []) as LegalCaseRow[];
  }

  if (!isCasesTableUnavailable(error)) {
    throw new Error(error.message || 'Error al cargar casos');
  }

  const { data: legacy, error: legacyErr } = await supabase
    .from('legal_cases')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (legacyErr) {
    throw new Error(
      legacyErr.message ||
        'No existe la tabla cases ni legal_cases. Ejecuta el SQL del repo (EJECUTAR_EN_SUPABASE o migraciones).'
    );
  }

  return (legacy ?? []).map((r) => mapLegacyLegalCaseRow(r as Record<string, unknown>));
}

export async function fetchLawyerLeads(lawyerId: string): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as LeadRow[];
}

export async function fetchLawyerActivity(lawyerId: string): Promise<LawyerActivityRow[]> {
  const { data, error } = await supabase
    .from('lawyer_activity')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as LawyerActivityRow[];
}

export function countActiveCases(cases: LegalCaseRow[]): number {
  return cases.filter(
    (c) =>
      !['closed', 'pending_approval', 'rejected_by_lawyer'].includes(c.status)
  ).length;
}

export function sumApprovedAmounts(rows: { amount: unknown }[]): number {
  return rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
}

/** Variación % entre suma del mes actual y el anterior (transacciones aprobadas) */
export function monthOverMonthChangePct(
  rows: { amount: unknown; created_at: string }[]
): number | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startThis = new Date(y, m, 1).getTime();
  const startPrev = new Date(y, m - 1, 1).getTime();
  const endPrev = startThis;

  let sumThis = 0;
  let sumPrev = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const amt = Number(r.amount ?? 0);
    if (t >= startThis) sumThis += amt;
    else if (t >= startPrev && t < endPrev) sumPrev += amt;
  }
  if (sumPrev === 0) return sumThis > 0 ? 100 : null;
  return Math.round(((sumThis - sumPrev) / sumPrev) * 100);
}

export function caseStatusLabel(status: LegalCaseStatus): { text: string; tone: 'success' | 'neutral' } {
  switch (status) {
    case 'pending_approval':
      return { text: 'PEND. APROBACIÓN', tone: 'neutral' };
    case 'rejected_by_lawyer':
      return { text: 'RECHAZADO', tone: 'neutral' };
    case 'active':
      return { text: 'ACTIVO', tone: 'neutral' };
    case 'in_court':
      return { text: 'EN TRIBUNAL', tone: 'neutral' };
    case 'pending':
      return { text: 'PENDIENTE', tone: 'neutral' };
    case 'paid':
      return { text: 'PAGADO', tone: 'success' };
    case 'drafting':
      return { text: 'BORRADOR', tone: 'neutral' };
    case 'consulting':
      return { text: 'CONSULTA', tone: 'neutral' };
    case 'closed':
      return { text: 'CERRADO', tone: 'neutral' };
    default:
      return { text: String(status).toUpperCase(), tone: 'neutral' };
  }
}

export function caseStatusIcon(
  status: LegalCaseStatus
): 'document-text-outline' | 'cash-outline' | 'time-outline' | 'flash-outline' | 'hammer-outline' | 'hourglass-outline' | 'close-circle-outline' {
  if (status === 'paid') return 'cash-outline';
  if (status === 'drafting') return 'time-outline';
  if (status === 'active') return 'flash-outline';
  if (status === 'in_court') return 'hammer-outline';
  if (status === 'pending_approval') return 'hourglass-outline';
  if (status === 'rejected_by_lawyer') return 'close-circle-outline';
  return 'document-text-outline';
}

export function activityIcon(
  t: LawyerActivityRow['event_type']
): 'star' | 'cash-outline' | 'person-add' | 'document-text-outline' | 'notifications-outline' {
  switch (t) {
    case 'review':
      return 'star';
    case 'payment':
      return 'cash-outline';
    case 'lead_view':
      return 'person-add';
    case 'case_update':
      return 'document-text-outline';
    default:
      return 'notifications-outline';
  }
}

export function activityDot(
  t: LawyerActivityRow['event_type']
): 'secondary' | 'primary' | 'muted' {
  if (t === 'review') return 'secondary';
  if (t === 'payment') return 'primary';
  return 'muted';
}

/** Casos del cliente (vista cliente) */
export async function fetchClientTransactions(clientId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, status, receipt_url, created_at, lawyer_id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientCases(clientId: string): Promise<LegalCaseRow[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as LegalCaseRow[];
}

/** Comprueba si el cliente tiene pago de fee aprobado para poder contactar al abogado (MVP: sin hitos internos). */
export async function hasApprovedFeeForLawyer(
  clientId: string,
  lawyerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('client_id', clientId)
    .eq('lawyer_id', lawyerId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

/** Opciones de estado para edición abogado (casos) */
/** Estados editables manualmente (sin `pending_approval`: usar Aprobar/Rechazar en el detalle). */
export const CASE_STATUS_EDIT_OPTIONS: { value: LegalCaseStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'consulting', label: 'Consulta' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'drafting', label: 'Borrador / elaboración' },
  { value: 'in_court', label: 'En tribunal' },
  { value: 'paid', label: 'Pagado' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'rejected_by_lawyer', label: 'Rechazado (oferta)' },
];

export async function updateLawyerCase(
  caseId: string,
  lawyerId: string,
  patch: {
    title?: string;
    description?: string | null;
    status?: LegalCaseStatus;
    last_activity?: string | null;
  }
): Promise<LegalCaseRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('cases')
    .update({
      ...patch,
      last_activity_at: now,
    })
    .eq('id', caseId)
    .eq('lawyer_id', lawyerId)
    .select()
    .single();
  if (error) throw error;
  const row = data as LegalCaseRow;

  const summary = patch.title
    ? patch.title
    : patch.status
      ? `Estado: ${patch.status}`
      : 'Notas actualizadas';
  void supabase.from('lawyer_activity').insert({
    lawyer_id: lawyerId,
    event_type: 'case_update',
    title: 'Caso actualizado',
    body: summary.slice(0, 200),
  });

  return row;
}

export async function updateLeadStatus(
  leadId: string,
  lawyerId: string,
  status: 'contacted' | 'dismissed'
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)
    .eq('lawyer_id', lawyerId);
  if (error) throw error;
}
