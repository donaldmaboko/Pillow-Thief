// ============================================================================
// payment-webhook — the ONLY code path that may mark a payment captured and
// advance a booking past `pending_payment`.
//
// Security:
//   * Signature verified via the gateway adapter (HMAC for the sandbox).
//   * Idempotent: events are keyed by (gateway, event id); replays no-op.
//   * Client-side "success" screens never change payment state.
// ============================================================================

import { error, json, optionsResponse } from '../_shared/http.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'
import { getGateway } from '../_shared/payments.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const raw = await req.text()
    const signature = req.headers.get('x-signature')
    const gateway = getGateway()

    let event
    try {
      event = await gateway.parseWebhook(raw, signature)
    } catch {
      return error('invalid_signature', 'Webhook signature verification failed', 401)
    }

    const db = supabaseAdmin()

    if (event.type === 'payment.captured' || event.type === 'payment.failed') {
      const { data: payment } = await db
        .from('payments')
        .select('*')
        .eq('gateway', gateway.name)
        .eq('gateway_intent_id', event.intentId)
        .maybeSingle()

      if (!payment) return error('not_found', 'Unknown payment intent', 404)

      // Idempotency: same event id twice => acknowledge and stop.
      if (payment.last_event_id === event.id) return json({ received: true, duplicate: true })

      if (event.type === 'payment.captured') {
        // Never re-capture an already captured/refunded payment.
        if (payment.status === 'captured') return json({ received: true, duplicate: true })

        const { error: updErr } = await db
          .from('payments')
          .update({
            status: 'captured',
            gateway_charge_id: event.intentId,
            last_event_id: event.id,
            last_event_at: new Date().toISOString(),
            captured_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
          .in('status', ['created', 'authorized', 'failed'])
        if (updErr) return error('external_service', updErr.message, 500)

        // Advance the booking according to the provider's booking mode.
        const { data: providerProfile } = await db
          .from('provider_profiles')
          .select('instant_booking')
          .eq('provider_id', payment.provider_id)
          .single()

        const nextStatus = providerProfile?.instant_booking ? 'confirmed' : 'pending_approval'
        const { error: txErr } = await db.rpc('transition_booking', {
          p_booking: payment.booking_id,
          p_to: nextStatus,
          p_actor: payment.client_id, // participant-driven transition
        })
        if (txErr) return error('external_service', txErr.message, 500)

        return json({ received: true, booking_status: nextStatus })
      }

      // payment.failed
      const { error: updErr } = await db
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: event.failureReason ?? 'declined',
          last_event_id: event.id,
          last_event_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .in('status', ['created', 'authorized'])
      if (updErr) return error('external_service', updErr.message, 500)

      // Release the slot: booking expires.
      await db.rpc('transition_booking', {
        p_booking: payment.booking_id,
        p_to: 'expired',
        p_actor: payment.client_id,
      })
      return json({ received: true, booking_status: 'expired' })
    }

    if (event.type === 'refund.processed') {
      const { error: updErr } = await db
        .from('refunds')
        .update({ status: 'succeeded', resolved_at: new Date().toISOString() })
        .eq('gateway_refund_id', event.refundId)
        .eq('status', 'processing')
      if (updErr) return error('external_service', updErr.message, 500)
      return json({ received: true })
    }

    return json({ received: true, ignored: true })
  } catch (err) {
    console.error(err)
    return error('internal', 'Webhook processing failed', 500)
  }
})
