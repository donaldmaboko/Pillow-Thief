import { useMutation } from '@tanstack/react-query'
import type { SwipeDirection, SwipeResult } from '@pillow-thief/shared'
import { requireSupabase } from '../../lib/supabase'

/**
 * Records a swipe. All matching logic (mutual like → match → conversation) runs
 * in one database transaction, so the client never decides whether a match
 * happened — it only reports what the server returned.
 */
export function useSwipe() {
  return useMutation({
    mutationFn: async ({ targetId, direction }: { targetId: string; direction: SwipeDirection }) => {
      const { data, error } = await requireSupabase().rpc('record_swipe', {
        p_target: targetId,
        p_direction: direction,
      })
      if (error) throw error
      return data as SwipeResult
    },
  })
}

export function useUnmatch() {
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await requireSupabase().rpc('unmatch', { p_match: matchId })
      if (error) throw error
    },
  })
}
