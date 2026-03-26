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
