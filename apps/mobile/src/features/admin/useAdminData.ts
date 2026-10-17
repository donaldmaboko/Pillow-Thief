import { useQuery } from '@tanstack/react-query'
import type { AdminMetrics, ApplicationQueueItem } from '@pillow-thief/shared'
import { requireSupabase } from '../../lib/supabase'

/**
 * Admin console reads. These go through PostgREST under the existing
 * `is_admin()` RLS policies — no service-role key, ever, in the mobile app.
 */

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('admin_metrics')
      if (error) throw error
      return data as AdminMetrics
    },
    staleTime: 15_000,
  })
}

export function useApplicationQueue(status: 'pending' | 'verified' | 'rejected' = 'pending') {
  return useQuery({
    queryKey: ['admin-applications', status],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('provider_applications')
        .select('id,user_id,status,display_name,legal_name,bio,city,base_price_60_minor,created_at')
        .eq('status', status)
        .order('created_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ApplicationQueueItem[]
    },
  })
}

export interface AdminReport {
  id: string
  category: string
  description: string
  status: string
  created_at: string
}

export interface AdminDispute {
  id: string
  booking_id: string
  reason: string
  status: string
  created_at: string
}

export interface AdminTicket {
  id: string
  category: string
  subject: string
  status: string
  created_at: string
}

export function useOpenReports() {
  return useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('reports')
        .select('id,category,description,status,created_at')
        .in('status', ['open', 'investigating'])
        .order('created_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AdminReport[]
    },
  })
}

export function useOpenDisputes() {
  return useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('disputes')
        .select('id,booking_id,reason,status,created_at')
        .in('status', ['open', 'investigating'])
        .order('created_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AdminDispute[]
    },
  })
}

export function useOpenTickets() {
  return useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('support_tickets')
        .select('id,category,subject,status,created_at')
        .in('status', ['open', 'pending_user'])
        .order('created_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AdminTicket[]
    },
  })
}

export interface PlatformSettings {
  commission_bps: number
  booking_fee_minor: number
  tax_rate_bps: number
  currency: string
  maintenance_mode: boolean
  bookings_enabled: boolean
  promo_enabled: boolean
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('platform_settings')
        .select('commission_bps,booking_fee_minor,tax_rate_bps,currency,maintenance_mode,bookings_enabled,promo_enabled')
        .eq('id', true)
        .maybeSingle()
      if (error) throw error
      return data as PlatformSettings | null
    },
  })
}
