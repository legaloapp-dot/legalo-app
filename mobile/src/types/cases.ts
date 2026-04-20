export type LegalCaseStatus =
  | 'awaiting_payment'
  | 'pending_approval'
  | 'rejected_by_lawyer'
  | 'reassignment_pending'
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
  lawyer_observations?: string | null;
  client_rating?: number | null;
  client_rating_comment?: string | null;
  client_rating_at?: string | null;
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
