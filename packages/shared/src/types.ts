/**
 * Domain types shared across the mobile app, admin dashboard, and backend.
 * These mirror the PostgreSQL schema (supabase/migrations) — keep in sync.
 */

import type { BookingStatus } from './bookingStatus'

export const USER_ROLES = ['client', 'provider', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const VERIFICATION_STATES = ['unverified', 'pending', 'verified', 'rejected', 'suspended'] as const
export type VerificationState = (typeof VERIFICATION_STATES)[number]

export const MEETING_ARRANGEMENTS = ['provider_travels', 'client_visits', 'public_meeting'] as const
export type MeetingArrangement = (typeof MEETING_ARRANGEMENTS)[number]

export const MEETING_ARRANGEMENT_LABELS: Record<MeetingArrangement, string> = {
  provider_travels: 'Provider comes to you',
  client_visits: 'You visit the provider’s approved location',
  public_meeting: 'Meet at an agreed public place',
}

export const SESSION_DURATIONS_MIN = [30, 60, 90, 120] as const

export const SUPPORTED_LANGUAGES = ['en', 'tn', 'af', 'zu', 'fr', 'pt', 'other'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  avatar_url: string | null
  /** ISO 3166-1 alpha-2; initial launch market is BW. */
  country: string
  preferred_language: SupportedLanguage
  terms_accepted_at: string | null
  privacy_accepted_at: string | null
  age_confirmed_at: string | null
  email_verified: boolean
  /** Non-essential notification preferences (essential notices are always sent). */
  notify_booking_updates: boolean
  notify_messages: boolean
  notify_promotions: boolean
  deactivated_at: string | null
  created_at: string
}

export interface ProviderProfile {
  provider_id: string
  display_name: string
  headline: string
  bio: string
  avatar_url: string | null
  photo_urls: string[]
  languages: SupportedLanguage[]
  verification: VerificationState
  /** Approximate, privacy-safe location (never the home address). */
  approx_lat: number | null
  approx_lng: number | null
  city: string
  neighbourhood: string | null
  avg_rating: number | null
  review_count: number
  base_price_minor: number
  currency: string
  accepts: MeetingArrangement[]
  next_available_at: string | null
}

export interface ProviderService {
  id: string
  provider_id: string
  title: string
  description: string
  /** All prices in integer minor units (thebe). */
  price_30_minor: number | null
  price_60_minor: number
  price_90_minor: number | null
  price_120_minor: number | null
  currency: string
  active: boolean
}

export interface WeeklyAvailabilityWindow {
  id: string
  provider_id: string
  /** 0 (Sunday) .. 6 (Saturday) */
  weekday: number
  start_minutes: number
  end_minutes: number
}

export interface AvailabilityException {
  id: string
  provider_id: string
  date: string
  blocked: boolean
  note: string | null
}

export interface ServiceArea {
  id: string
  provider_id: string
  name: string
  city: string
  lat: number
  lng: number
  radius_km: number
  /** Whether the provider travels to clients within this area. */
  house_calls: boolean
  travel_base_fee_minor: number
  travel_per_km_minor: number
  max_travel_km: number
}

export interface Booking {
  id: string
  client_id: string
  provider_id: string
  service_id: string
  status: BookingStatus
  duration_min: number
  starts_at: string
  ends_at: string
  meeting_arrangement: MeetingArrangement
  /** Minor units — always computed server-side. */
  session_price_minor: number
  travel_fee_minor: number
  booking_fee_minor: number
  tax_minor: number
  discount_minor: number
  total_minor: number
  commission_minor: number
  currency: string
  cancellation_policy: {
    full_refund_before_hours: number
    partial_refund_before_hours: number
    partial_refund_percent: number
  }
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  provider_id: string
  author_id: string
  rating: number
  professionalism: number
  punctuality: number
  communication: number
  respect_for_boundaries: number
  accuracy: number
  body: string | null
  provider_response: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  kind: string
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  booking_id: string | null
  client_id: string
  provider_id: string
  last_message_at: string | null
  last_message_preview: string | null
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

export interface PayoutSummary {
  provider_id: string
  period_start: string
  period_end: string
  gross_minor: number
  commission_minor: number
  refunds_minor: number
  adjustments_minor: number
  net_minor: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed'
}

export interface AdminOverviewMetrics {
  total_clients: number
  total_providers: number
  pending_verifications: number
  active_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  gross_booking_value_minor: number
  platform_revenue_minor: number
  refunds_minor: number
  open_disputes: number
  open_reports: number
}
