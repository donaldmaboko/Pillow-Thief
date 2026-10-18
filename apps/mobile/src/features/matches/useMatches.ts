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
    // Unique topic per subscription, deliberately.
    //
    // supabase-js keys its channels by topic and `channel(topic)` RETURNS the
    // existing channel when the topic matches. `removeChannel()` is async, so
    // anything that re-runs this effect before its promise settles — Fast
    // Refresh, session hydration, a tab remount — would be handed the previous,
    // still-subscribed channel and the next `.on()` would throw
    // "cannot add `postgres_changes` callbacks ... after `subscribe()`".
    // A unique topic makes that collision impossible.
    const topic = `matches-${userId}-${Math.random().toString(36).slice(2, 10)}`
    const channel = sb
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        void qc.invalidateQueries({ queryKey: ['matches'] })
        void qc.invalidateQueries({ queryKey: ['who-liked-me'] })
      })
      .subscribe()

    return () => {
      void sb.removeChannel(channel)
    }
  }, [userId, qc])
}
