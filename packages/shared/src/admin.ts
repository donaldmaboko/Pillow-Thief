/**
 * Admin console contract — mirrors the admin RPCs in
 * supabase/migrations/20261017000001_roles_hardening.sql.
 */

export const VERIFICATION_ACTIONS = ['approve', 'reject', 'request_more_info'] as const
export type VerificationAction = (typeof VERIFICATION_ACTIONS)[number]

export const VERIFICATION_ACTION_LABELS: Record<VerificationAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request_more_info: 'Request more info',
}

export const PROVIDER_STATUS_ACTIONS = ['suspend', 'reinstate', 'publish', 'unpublish'] as const
export type ProviderStatusAction = (typeof PROVIDER_STATUS_ACTIONS)[number]

export const PROVIDER_STATUS_ACTION_LABELS: Record<ProviderStatusAction, string> = {
  suspend: 'Suspend',
  reinstate: 'Reinstate',
  publish: 'Publish',
  unpublish: 'Unpublish',
}

export const REPORT_STATUS_ACTIONS = ['investigating', 'resolved', 'dismissed'] as const
export type ReportStatusAction = (typeof REPORT_STATUS_ACTIONS)[number]

export const REPORT_STATUS_ACTION_LABELS: Record<ReportStatusAction, string> = {
  investigating: 'Investigating',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

/** Exact shape returned by `rpc/admin_metrics`. */
export interface AdminMetrics {
  users_total: number
  clients: number
  providers: number
  admins: number
  applications_pending: number
  providers_verified: number
  providers_published: number
  bookings_total: number
  bookings_by_status: Record<string, number>
  gmv_30d_minor: number
  commission_30d_minor: number
  payouts_pending_minor: number
  open_reports: number
  open_disputes: number
  open_tickets: number
}

/** A row in the admin verification queue. */
export interface ApplicationQueueItem {
  id: string
  user_id: string
  status: string
  display_name: string
  legal_name: string
  bio: string
  city: string | null
  base_price_60_minor: number
  created_at: string
}
