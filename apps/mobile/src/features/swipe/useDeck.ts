import { useQuery } from '@tanstack/react-query'
import { SWIPE_BATCH_SIZE, type DeckCard } from '@pillow-thief/shared'
import { requireSupabase } from '../../lib/supabase'

export interface Coords {
  lat: number
  lng: number
}

/**
 * The swipe deck. Distance-sorted server-side, and already excludes anyone the
 * caller has swiped, blocked, or that is unverified/unpublished — the filter
 * lives in the database so a stale client cannot widen it.
 */
export function useDeck(coords: Coords | null, maxKm = 50) {
  return useQuery({
    queryKey: ['deck', coords?.lat ?? null, coords?.lng ?? null, maxKm],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('discovery_deck', {
        p_lat: coords?.lat ?? null,
        p_lng: coords?.lng ?? null,
        p_max_km: maxKm,
        p_limit: SWIPE_BATCH_SIZE,
      })
      if (error) throw error
      return (data ?? []) as DeckCard[]
    },
    staleTime: 30_000,
  })
}
