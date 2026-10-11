// ============================================================================
// Payment provider abstraction.
//
// Pillow Thief launches in Botswana (BWP). The gateway is behind this
// interface so it can be swapped without touching booking logic.
//
// SHIP MODE: when no production gateway credentials are configured the
// platform runs the explicitly-labelled SANDBOX adapter below. It simulates
// intents, captures and refunds, and signs its own webhooks with
// SANDBOX_WEBHOOK_SECRET so the webhook pipeline is exercised end-to-end.
//
// To go live: implement PaymentGatewayAdapter for a provider confirmed to
// support Botswana merchant accounts + payouts (see docs/PAYMENTS.md for the
// assessment checklist), set PAYMENT_PROVIDER, and keep this sandbox for dev.
// ============================================================================

export interface PaymentIntentParams {
  bookingId: string
  amountMinor: number
  currency: string
  customerEmail: string
  metadata: Record<string, string>
}

export interface PaymentIntent {
  intentId: string
  /** Opaque token/URL the client uses to complete payment. */
  clientPayload: Record<string, unknown>
  gateway: 'sandbox' | 'gateway'
}

export interface RefundResult {
  refundId: string
  status: 'pending' | 'succeeded' | 'failed'
}

export interface WebhookEvent {
  id: string
  type: 'payment.captured' | 'payment.failed' | 'refund.processed'
  intentId?: string
  refundId?: string
  failureReason?: string
}

export interface PaymentGatewayAdapter {
  readonly name: 'sandbox' | 'gateway'
  createIntent(params: PaymentIntentParams): Promise<PaymentIntent>
  refund(intentId: string, amountMinor: number, reason: string): Promise<RefundResult>
  /**
   * Verify the webhook signature and parse the event.
   * Throws on an invalid signature. May be asynchronous (crypto verification).
   */
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent | Promise<WebhookEvent>
}

// ---------------------------------------------------------------------------
// Sandbox adapter (clearly simulated; DEV ONLY)
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function sandboxSecret(): string {
  const secret = Deno.env.get('SANDBOX_WEBHOOK_SECRET')
  if (!secret) throw new Error('SANDBOX_WEBHOOK_SECRET is not set')
  return secret
}

export const sandboxGateway: PaymentGatewayAdapter = {
  name: 'sandbox',

  async createIntent(params) {
    // Simulated intent id. In dev the client immediately calls the
    // sandbox-gateway function to "pay", which emits a signed webhook.
    const intentId = `sandbox_pi_${params.bookingId.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`
    return {
      intentId,
      gateway: 'sandbox',
      clientPayload: {
        sandbox: true,
        notice: 'Simulated payment — no real charge. Sandbox mode is active.',
        pay_url_hint: `POST ${Deno.env.get('SUPABASE_URL')}/functions/v1/sandbox-gateway with {"intent_id": "${intentId}", "outcome": "captured"}`,
      },
    }
  },

  async refund(intentId, amountMinor, _reason) {
    return {
      refundId: `sandbox_re_${crypto.randomUUID().slice(0, 12)}`,
      status: 'succeeded',
    }
  },

  async parseWebhook(rawBody, signature) {
    const secret = sandboxSecret()
    const expected = await hmacSha256Hex(secret, rawBody)
    if (!signature || signature !== expected) {
      throw new Error('invalid_signature')
    }
    const event = JSON.parse(rawBody) as WebhookEvent & { amount?: number }
    if (!event.id || !event.type) throw new Error('malformed_event')
    return event
  },
}

/** Utility reused by the sandbox-gateway function to sign simulated events. */
export async function signSandboxEvent(payload: object): Promise<{ raw: string; signature: string }> {
  const raw = JSON.stringify(payload)
  return { raw, signature: await hmacSha256Hex(sandboxSecret(), raw) }
}

export function getGateway(): PaymentGatewayAdapter {
  const provider = Deno.env.get('PAYMENT_PROVIDER') ?? 'sandbox'
  if (provider === 'sandbox') return sandboxGateway
  // Production adapters plug in here. Refuse to start if misconfigured:
  throw new Error(
    `PAYMENT_PROVIDER="${provider}" has no adapter wired yet. Configure a Botswana-capable gateway (see docs/PAYMENTS.md) or set PAYMENT_PROVIDER=sandbox.`,
  )
}
