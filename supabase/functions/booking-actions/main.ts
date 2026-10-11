// ============================================================================
// booking-actions — provider accept/decline and client cancel, with refunds.
//
// POST { action: 'accept' | 'decline' | 'cancel', booking_id, reason? }
//
// Accept/decline are provider-only; cancel is client-only. Authorization is
// checked against the booking participants server-side — never trusted from
// the client payload. Refunds are issued through the gateway adapter and the
// resulting refund recorded server-side.
// ============================================================================

import { z } from 'zod'
import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { requireUser, supabaseAdmin } from '../_shared/supabase.ts'
import { getGateway } from '../_shared/payments.ts'

const bodySchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel']),
  booking_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const userId = await requireUser(req)
    const { data: raw } = await readJsonBody(req)
    const body = bodySchema.parse(raw)
    const db = supabaseAdmin()

    const { data: booking } = await db
      .from('bookings')
      .select('*, provider_profiles(instant_booking)')
      .eq('id', body.booking_id)
      .maybeSingle()
    if (!booking) return error('not_found', 'Booking not found', 404)

    // ---- ACCEPT (provider only) ----
    if (body.action === 'accept') {
      if (booking.provider_id !== userId) return error('forbidden', 'Only the provider can accept', 403)
      const { error: accErr } = await db.rpc('provider_accept_booking', {
        p_booking: body.booking_id,
        p_provider: userId,
      })
      if (accErr) return error('invalid_transition', accErr.message, 409)
      return json({ ok: true, status: 'confirmed' })
    }

    // ---- DECLINE (provider only) -> auto full refund ----
    if (body.action === 'decline') {
      if (booking.provider_id !== userId) return error('forbidden', 'Only the provider can decline', 403)
      const { error: decErr } = await db.rpc('provider_decline_booking', {
        p_booking: body.booking_id,
        p_provider: userId,
        p_reason: body.reason ?? null,
      })
      if (decErr) return error('invalid_transition', decErr.message, 409)

      await issueFullRefund(booking.id, 'provider_declined')
      return json({ ok: true, status: 'declined', refunded: true })
    }

    // ---- CANCEL (client only) -> policy-based refund ----
    if (booking.client_id !== userId) return error('forbidden', 'Only the client can cancel', 403)
    const { data: cancelResult, error: canErr } = await db.rpc('client_cancel_booking', {
      p_booking: body.booking_id,
      p_client: userId,
      p_reason: body.reason ?? null,
    })
    if (canErr) return error('invalid_transition', canErr.message, 409)

    const refundMinor = cancelResult?.refund_minor ?? 0
    let refunded = false
    if (refundMinor > 0) {
      refunded = await issueRefund(booking.id, refundMinor, 'client_cancellation_policy')
    }
    return json({ ok: true, status: 'cancelled', refund_percent: cancelResult?.refund_percent, refunded })
  } catch (err) {
    if (err instanceof z.ZodError) return error('validation', err.errors[0]?.message ?? 'Invalid input', 422)
    if (err instanceof Error && err.message === 'auth_required') return error('auth_required', 'Sign in required', 401)
    console.error(err)
    return error('internal', 'Action failed', 500)
  }
})

// ---------------------------------------------------------------------------
async function issueFullRefund(bookingId: string, reason: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data: payment } = await db
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'captured')
    .maybeSingle()
  if (!payment) return false
  return issueRefund(bookingId, payment.amount_minor, reason)
}

async function issueRefund(bookingId: string, amountMinor: number, reason: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data: payment } = await db
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'captured')
    .maybeSingle()
  if (!payment) return false

  const gateway = getGateway()
  const refund = await gateway.refund(payment.gateway_intent_id!, amountMinor, reason)

  const { error: refErr } = await db.from('refunds').insert({
    payment_id: payment.id,
    booking_id: bookingId,
    gateway_refund_id: refund.refundId,
    status: refund.status === 'succeeded' ? 'succeeded' : 'processing',
    amount_minor: amountMinor,
    currency: payment.currency,
    reason,
    resolved_at: refund.status === 'succeeded' ? new Date().toISOString() : null,
  })
  if (refErr) {
    console.error('refund insert failed', refErr)
    return false
  }

  // Mark the payment partially/fully refunded.
  const { data: existing } = await db
    .from('refunds')
    .select('amount_minor')
    .eq('payment_id', payment.id)
    .in('status', ['succeeded', 'processing'])
  const refundedTotal = (existing ?? []).reduce((sum, r) => sum + r.amount_minor, 0)
  const newStatus = refundedTotal >= payment.amount_minor ? 'refunded' : 'partially_refunded'
  await db.from('payments').update({ status: newStatus }).eq('id', payment.id)
  return true
}
