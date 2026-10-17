import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ProviderStatusAction,
  ReportStatusAction,
  VerificationAction,
} from '@pillow-thief/shared'
import { requireSupabase } from '../../lib/supabase'

function invalidateAdmin(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-metrics'] })
  qc.invalidateQueries({ queryKey: ['admin-applications'] })
  qc.invalidateQueries({ queryKey: ['admin-reports'] })
  qc.invalidateQueries({ queryKey: ['admin-disputes'] })
  qc.invalidateQueries({ queryKey: ['admin-tickets'] })
}

/** Approve / reject / request more info. Server-side, is_admin()-gated. */
export function useDecideApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { applicationId: string; action: VerificationAction; note?: string }) => {
      const { data, error } = await requireSupabase().rpc('admin_decide_application', {
        p_application: input.applicationId,
        p_action: input.action,
        p_note: input.note ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateAdmin(qc),
  })
}

/** Suspend / reinstate / publish / unpublish a provider. */
export function useSetProviderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { providerId: string; action: ProviderStatusAction }) => {
      const { data, error } = await requireSupabase().rpc('admin_set_provider_status', {
        p_provider: input.providerId,
        p_action: input.action,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateAdmin(qc),
  })
}

/**
 * Reports, disputes and tickets already have an `is_admin()` UPDATE policy, so
 * they go straight through PostgREST — no RPC needed.
 */
export function useUpdateReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { reportId: string; status: ReportStatusAction; note?: string }) => {
      const closed = input.status === 'resolved' || input.status === 'dismissed'
      const { error } = await requireSupabase()
        .from('reports')
        .update({
          status: input.status,
          resolution_note: input.note ?? null,
          resolved_at: closed ? new Date().toISOString() : null,
        })
        .eq('id', input.reportId)
      if (error) throw error
    },
    onSuccess: () => invalidateAdmin(qc),
  })
}

export function useResolveDispute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { disputeId: string; note?: string }) => {
      const { error } = await requireSupabase()
        .from('disputes')
        .update({
          status: 'resolved',
          resolution_note: input.note ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', input.disputeId)
      if (error) throw error
    },
    onSuccess: () => invalidateAdmin(qc),
  })
}

export function useResolveTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ticketId: string; note?: string }) => {
      const { error } = await requireSupabase()
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolution_note: input.note ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', input.ticketId)
      if (error) throw error
    },
    onSuccess: () => invalidateAdmin(qc),
  })
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      commission_bps: number
      booking_fee_minor: number
      tax_rate_bps: number
      maintenance_mode: boolean
      bookings_enabled: boolean
    }) => {
      const { error } = await requireSupabase()
        .from('platform_settings')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAdmin(qc)
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}
