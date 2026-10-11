// ============================================================================
// sandbox-gateway — DEV-ONLY simulated payment gateway.
//
// Emits correctly-signed webhook events to the payment-webhook function so
// the full payment pipeline (signature verification, idempotency, booking
// transitions) is exercised without real charges. NEVER deployed to prod
// with PAYMENT_PROVIDER != sandbox.
//
// POST { intent_id: string, outcome: 'captured' | 'failed' }
// ============================================================================

import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { signSandboxEvent } from '../_shared/payments.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if ((Deno.env.get('PAYMENT_PROVIDER') ?? 'sandbox') !== 'sandbox') {
    return error('forbidden', 'Sandbox gateway is disabled outside sandbox mode', 403)
  }

  try {
    const { data } = await readJsonBody(req)
    const body = data as { intent_id?: string; outcome?: 'captured' | 'failed' }
    if (!body.intent_id || !['captured', 'failed'].includes(body.outcome ?? '')) {
      return error('validation', 'intent_id and outcome (captured|failed) are required', 422)
    }

    const event = {
      id: `sandbox_evt_${crypto.randomUUID()}`,
      type: body.outcome === 'captured' ? 'payment.captured' : 'payment.failed',
      intentId: body.intent_id,
      failureReason: body.outcome === 'failed' ? 'card_declined_simulated' : undefined,
    }
    const { raw, signature } = await signSandboxEvent(event)

    // Deliver to our own webhook endpoint (real HTTP round-trip so the
    // signature path is genuinely tested).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const res = await fetch(`${supabaseUrl}/functions/v1/payment-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: raw,
    })

    const result = await res.json()
    return json({ simulated: true, outcome: body.outcome, webhook_status: res.status, webhook_result: result }, res.status === 200 ? 200 : 502)
  } catch (err) {
    console.error(err)
    return error('internal', 'Sandbox simulation failed', 500)
  }
})
