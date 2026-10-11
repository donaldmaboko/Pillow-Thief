import { requireSupabase } from './supabase'
import { config } from './config'

/**
 * Typed client for the Pillow Thief Edge Functions.
 * Every mutation flows through these server-side functions; the client never
 * talks to payment gateways or computes authoritative prices itself.
 */

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function call<T>(fn: string, body: unknown): Promise<T> {
  const sb = requireSupabase()
  const { data: session } = await sb.auth.getSession()
  const res = await fetch(`${config.supabaseUrl}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.session?.access_token ?? config.supabaseAnonKey}`,
    },
    body: JSON.stringify(body ?? {}),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & Record<string, unknown>
  if (!res.ok) {
    throw new ApiError(json.error?.code ?? 'error', json.error?.message ?? `Request failed (${res.status})`, res.status)
  }
  return json as T
}

export interface QuoteResponse {
  currency: string
  session_price_minor: number
  travel_fee_minor: number
  booking_fee_minor: number
  tax_minor: number
  total_minor: number
  travel: {
    distance_km: number | null
    duration_min: number | null
    live: boolean
    client_lat?: number
    client_lng?: number
    client_label?: string
    client_place_id?: string
  }
  degraded_travel: boolean
  travel_is_estimate: boolean
}

export interface BookingCreatedResponse {
  booking_id: string
  status: string
  total_minor: number
  currency: string
  payment: {
    intentId: string
    gateway: 'sandbox' | 'gateway'
    clientPayload: Record<string, unknown>
  }
}

export const api = {
  quote: (body: Record<string, unknown>) => call<QuoteResponse>('booking-quote', body),

  createBooking: (body: Record<string, unknown>) => call<BookingCreatedResponse>('booking-create', body),

  bookingAction: (body: { action: 'accept' | 'decline' | 'cancel'; booking_id: string; reason?: string }) =>
    call<{ ok: boolean; status: string; refunded?: boolean; refund_percent?: number }>('booking-actions', body),

  paySandbox: (body: { intent_id: string; outcome: 'captured' | 'failed' }) =>
    call<{ simulated: boolean; webhook_status: number }>('sandbox-gateway', body),

  deleteAccount: () => call<{ deleted: boolean }>('account-delete', { confirm: true }),
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}
