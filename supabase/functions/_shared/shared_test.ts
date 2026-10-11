// Deno tests for the shared Edge Function modules.
// Run: deno test --allow-env supabase/functions/_shared/
//
// Focus: the payment webhook signature path (the security boundary that decides
// whether money is considered received) and the routing fallback maths.

import { sandboxGateway, signSandboxEvent, getGateway } from './payments.ts'
import { haversineKm, routeEstimate } from './google.ts'

// Self-contained assertions so the suite needs no remote imports.
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${String(expected)}, received ${String(actual)}`)
  }
}

async function assertRejects(fn: () => Promise<unknown>, msg?: string): Promise<void> {
  let threw = false
  try {
    await fn()
  } catch {
    threw = true
  }
  if (!threw) throw new Error(msg ?? 'expected the call to reject, but it resolved')
}

Deno.env.set('SANDBOX_WEBHOOK_SECRET', 'test-secret-value-do-not-use-in-production')
Deno.env.set('PAYMENT_PROVIDER', 'sandbox')

Deno.test('sandbox webhook: valid signature is accepted', async () => {
  const event = {
    id: 'evt_1',
    type: 'payment.captured' as const,
    intentId: 'sandbox_pi_abc123',
  }
  const { raw, signature } = await signSandboxEvent(event)
  const parsed = await sandboxGateway.parseWebhook(raw, signature)
  assertEquals(parsed.type, 'payment.captured')
  assertEquals(parsed.intentId, 'sandbox_pi_abc123')
})

Deno.test('sandbox webhook: forged signature is rejected', async () => {
  const { raw } = await signSandboxEvent({ id: 'evt_2', type: 'payment.captured', intentId: 'x' })
  await assertRejects(() => Promise.resolve(sandboxGateway.parseWebhook(raw, 'deadbeef')))
  await assertRejects(() => Promise.resolve(sandboxGateway.parseWebhook(raw, null)))
})

Deno.test('sandbox webhook: tampered payload is rejected', async () => {
  const { raw, signature } = await signSandboxEvent({ id: 'evt_3', type: 'payment.captured', intentId: 'small' })
  const tampered = raw.replace('small', 'huge')
  await assertRejects(() => Promise.resolve(sandboxGateway.parseWebhook(tampered, signature)))
})

Deno.test('sandbox webhook: malformed event object is rejected', async () => {
  const { raw, signature } = await signSandboxEvent({ id: 'evt_4' })
  await assertRejects(() => Promise.resolve(sandboxGateway.parseWebhook(raw, signature)))
})

Deno.test('gateway selection: sandbox mode resolves the sandbox adapter', () => {
  assertEquals(getGateway().name, 'sandbox')
})

Deno.test('gateway selection: unconfigured provider fails loudly', () => {
  Deno.env.set('PAYMENT_PROVIDER', 'acme')
  try {
    let threw = false
    try {
      getGateway()
    } catch {
      threw = true
    }
    assertEquals(threw, true, 'an unwired provider must not silently fall back to sandbox')
  } finally {
    Deno.env.set('PAYMENT_PROVIDER', 'sandbox')
  }
})

Deno.test('haversine: Gaborone CBD to Phakalane is roughly 7 km', () => {
  const km = haversineKm(-24.6282, 25.9231, -24.567, 25.983)
  if (km < 5 || km > 10) throw new Error(`unexpected distance: ${km}`)
})

Deno.test('routeEstimate: falls back to a labelled estimate without an API key', async () => {
  Deno.env.delete('GOOGLE_MAPS_SERVER_KEY')
  const est = await routeEstimate({ lat: -24.6282, lng: 25.9231 }, { lat: -24.567, lng: 25.983 })
  assertEquals(est.live, false, 'must not claim a live route without a key')
  if (!(est.distanceKm > 0) || !(est.durationMin >= 1)) throw new Error('estimate must be usable')
})
