/** Debe coincidir con `cases_status_check` en Supabase. */
export const CASE_STATUSES = [
  "awaiting_payment",
  "pending_approval",
  "rejected_by_lawyer",
  "reassignment_pending",
  "active",
  "in_court",
  "pending",
  "closed",
  "drafting",
  "consulting",
  "paid",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Etiquetas UI admin (listado y detalle de casos). */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  awaiting_payment: "Validando pago",
  pending_approval: "Pendiente de aprobación",
  rejected_by_lawyer: "Rechazado por abogado",
  reassignment_pending: "Reasignación pendiente",
  active: "Activo",
  in_court: "En tribunal",
  pending: "Pendiente",
  closed: "Cerrado",
  drafting: "Borrador",
  consulting: "Consulta",
  paid: "Pagado",
};

export type CaseRow = {
  id: string;
  client_id: string;
  lawyer_id: string;
  title: string;
  description: string | null;
  client_display_name: string | null;
  status: string;
  last_activity: string | null;
  last_activity_at: string | null;
  created_at: string;
  client_name: string | null;
  lawyer_name: string | null;
};

export function isValidStatus(s: string): s is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(s);
}
