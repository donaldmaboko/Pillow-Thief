import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from './supabase'
import { api } from './api'

/**
 * TanStack Query data hooks — the only place the UI touches Supabase.
 * Presentation components consume these hooks and never build queries.
 */

export interface DiscoveryProvider {
  provider_id: string
  display_name: string
  headline: string
  bio_excerpt: string
  avatar_url: string | null
  languages: string[]
  city: string
  neighbourhood: string | null
  lat: number | null
  lng: number | null
  accepts: string[]
  instant_booking: boolean
  avg_rating: number | null
  review_count: number
  starting_price_minor: number | null
  durations: number[]
}

export interface DiscoveryFilters {
  city?: string
  search?: string
  maxPriceMinor?: number
  minRating?: number
  arrangement?: string
  language?: string
  houseCalls?: boolean
  sortBy?: 'relevance' | 'price' | 'rating'
}

export function useDiscovery(filters: DiscoveryFilters = {}) {
  return useQuery({
    queryKey: ['discovery', filters],
    queryFn: async () => {
      const sb = requireSupabase()
      let q = sb.from('provider_discovery').select('*')
      if (filters.city) q = q.ilike('city', `%${filters.city}%`)
      if (filters.arrangement) q = q.contains('accepts', [filters.arrangement])
      if (filters.language) q = q.contains('languages', [filters.language])
      if (filters.minRating) q = q.gte('avg_rating', filters.minRating)
      if (filters.maxPriceMinor) q = q.lte('starting_price_minor', filters.maxPriceMinor)
      if (filters.houseCalls) q = q.contains('accepts', ['provider_travels'])
      if (filters.search) {
        q = q.or(`display_name.ilike.%${filters.search}%,neighbourhood.ilike.%${filters.search}%`)
      }
      if (filters.sortBy === 'price') q = q.order('starting_price_minor', { ascending: true, nullsFirst: false })
      else if (filters.sortBy === 'rating') q = q.order('avg_rating', { ascending: false, nullsFirst: false })
      else q = q.order('review_count', { ascending: false })
      const { data, error } = await q.limit(60)
      if (error) throw error
      return (data ?? []) as DiscoveryProvider[]
    },
    staleTime: 30_000,
  })
}

export function useProviderProfile(providerId: string | undefined) {
  return useQuery({
    queryKey: ['provider', providerId],
    enabled: Boolean(providerId),
    queryFn: async () => {
      const sb = requireSupabase()
      const [{ data: discovery, error: dErr }, { data: services, error: sErr }, { data: areas, error: aErr }, { data: locations, error: lErr }] =
        await Promise.all([
          sb.from('provider_discovery').select('*').eq('provider_id', providerId!).maybeSingle(),
          sb.from('provider_services').select('*').eq('provider_id', providerId!).eq('active', true),
          sb.from('provider_service_areas_public').select('*').eq('provider_id', providerId!),
          sb.from('provider_service_locations').select('*').eq('provider_id', providerId!).eq('active', true),
        ])
      if (dErr) throw dErr
      if (sErr) throw sErr
      if (aErr) throw aErr
      if (lErr) throw lErr
      return { discovery, services: services ?? [], areas: areas ?? [], locations: locations ?? [] }
    },
    staleTime: 30_000,
  })
}

export function useProviderReviews(providerId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', providerId],
    enabled: Boolean(providerId),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('reviews')
        .select('id, rating, body, created_at, professionalism, punctuality, communication, respect_for_boundaries, accuracy')
        .eq('provider_id', providerId!)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAvailableSlots(providerId: string | undefined, dateISO: string | undefined, durationMin: number) {
  return useQuery({
    queryKey: ['slots', providerId, dateISO, durationMin],
    enabled: Boolean(providerId && dateISO),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb.rpc('available_slots', {
        p_provider: providerId!,
        p_date: dateISO!,
        p_duration_min: durationMin,
      })
      if (error) throw error
      return (data ?? []) as { start_minute: number }[]
    },
    staleTime: 15_000,
  })
}

export function useMyBookings(statuses?: string[]) {
  return useQuery({
    queryKey: ['my-bookings', statuses],
    queryFn: async () => {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      if (!uid) return []
      let q = sb
        .from('bookings')
        .select('*, provider_profiles(display_name, headline), provider_services(title)')
        .or(`client_id.eq.${uid},provider_id.eq.${uid}`)
        .order('starts_at', { ascending: true })
      if (statuses && statuses.length > 0) q = q.in('status', statuses)
      const { data, error } = await q.limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

export function useBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['booking', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('bookings')
        .select('*, booking_locations(*), provider_profiles(display_name, headline, full_refund_before_hours), provider_services(title, description), profiles!bookings_client_id_fkey(display_name, avatar_url)')
        .eq('id', bookingId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      if (!uid) return []
      const { data, error } = await sb
        .from('conversations')
        .select('*, profiles!conversations_client_id_fkey(display_name), provider_profiles(display_name)')
        .or(`client_id.eq.${uid},provider_id.eq.${uid}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

export function useFavourites() {
  return useQuery({
    queryKey: ['favourites'],
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb.from('favourites').select('provider_id, created_at').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as { provider_id: string; created_at: string }[]
    },
  })
}

export function useToggleFavourite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ providerId }: { providerId: string }) => {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      if (!uid) throw new Error('Sign in required')
      const { data: existing } = await sb.from('favourites').select('provider_id').eq('provider_id', providerId).eq('user_id', uid).maybeSingle()
      if (existing) {
        const { error } = await sb.from('favourites').delete().eq('provider_id', providerId).eq('user_id', uid)
        if (error) throw error
        return { favourited: false }
      }
      const { error } = await sb.from('favourites').insert({ provider_id: providerId, user_id: uid })
      if (error) throw error
      return { favourited: true }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favourites'] }),
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const sb = requireSupabase()
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (review: Record<string, unknown>) => {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      if (!uid) throw new Error('Sign in required')
      const booking = review.booking_id as string
      // Server-side eligibility check (defense in depth; RLS also enforces).
      const { data: eligible } = await sb.rpc('can_review_booking', { p_booking: booking })
      if (!eligible) throw new Error('This booking is not eligible for a review yet.')
      const { data: b, error: bErr } = await sb.from('bookings').select('provider_id').eq('id', booking).single()
      if (bErr || !b) throw new Error('Booking not found')
      const { error } = await sb.from('reviews').insert({ ...review, author_id: uid, provider_id: b.provider_id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
}

export function useQuote(params: Record<string, unknown> | null) {
  return useQuery({
    queryKey: ['quote', params],
    enabled: params != null,
    queryFn: () => api.quote(params!),
    staleTime: 60_000,
    retry: false,
  })
}
