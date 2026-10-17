import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LikeSummary, MatchSummary } from '@pillow-thief/shared'
import { requireSupabase } from '../../lib/supabase'
import { useSession } from '../../stores/session'

export function useMatches(limit = 50) {
  return useQuery({
    queryKey: ['matches', limit],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('list_matches', { p_limit: limit })
      if (error) throw error
      return (data ?? []) as MatchSummary[]
    },
  })
}

export function useWhoLikedMe(limit = 50) {
  return useQuery({
    queryKey: ['who-liked-me', limit],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('list_who_liked_me', { p_limit: limit })
      if (error) throw error
      return (data ?? []) as LikeSummary[]
    },
  })
}

/**
 * Live match feed. RLS still applies to the Realtime stream, so a client only
 * ever receives its own matches. Any change invalidates the cached lists.
 */
export function useMatchesRealtime() {
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)

  useEffect(() => {
    if (!userId) return
    const sb = requireSupabase()
    const channel = sb
      .channel(`matches-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        qc.invalidateQueries({ queryKey: ['matches'] })
        qc.invalidateQueries({ queryKey: ['who-liked-me'] })
      })
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [userId, qc])
}
