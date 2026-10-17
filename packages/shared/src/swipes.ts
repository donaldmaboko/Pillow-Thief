/**
 * Swipe deck + mutual matching contract.
 *
 * Mirrors the server: `public.swipe_direction`, the `discovery_deck` row shape,
 * and the return value of `record_swipe`. Keep in sync with
 * supabase/migrations/20261017000002_swipes_matching.sql.
 */

export const SWIPE_DIRECTIONS = ['like', 'pass', 'super_like'] as const
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number]

export const SWIPE_DIRECTION_LABELS: Record<SwipeDirection, string> = {
  like: 'Like',
  pass: 'Pass',
  super_like: 'Super like',
}

/** One card in the deck — a provider the caller has not swiped yet. */
export interface DeckCard {
  provider_id: string
  display_name: string
  avatar_url: string | null
  headline: string | null
  city: string | null
  neighbourhood: string | null
  /** Rounded km from the caller, or null when either side has no location. */
  distance_km: number | null
  avg_rating: number | null
  review_count: number
  starting_price_minor: number | null
  languages: string[]
  instant_booking: boolean
  verification: string
}

export interface SwipeResult {
  direction: SwipeDirection
  matched: boolean
  match_id?: string
  conversation_id?: string
}

export interface MatchSummary {
  match_id: string
  other_id: string
  display_name: string
  avatar_url: string | null
  conversation_id: string | null
  matched_at: string
}

/** Someone who liked the caller and has not been answered yet. */
export interface LikeSummary {
  actor_id: string
  display_name: string
  avatar_url: string | null
  city: string | null
  liked_at: string
}

/** Deck page size — keeps the payload bounded on a slow connection. */
export const SWIPE_BATCH_SIZE = 20

/** Mirrors the server-side rate limit in `record_swipe`. */
export const SWIPE_RATE_LIMIT_PER_HOUR = 200

/** Reserving a few cards early keeps the stack from emptying mid-gesture. */
export const SWIPE_REFILL_THRESHOLD = 4
