# Pillow Thief — Payments & Payouts

## 0. Current state (be honest with users and stakeholders)

Pillow Thief ships with a **clearly labelled sandbox payment adapter**. It
exercises the entire pipeline — intent creation, signature-verified webhooks,
idempotency, refunds recorded in the ledger — but **no real money moves** until
a production gateway is configured. The app displays a "SANDBOX — payments are
simulated" banner whenever `EXPO_PUBLIC_SANDBOX_MODE=true`, and the sandbox
gateway function refuses to run when `PAYMENT_PROVIDER` is not `sandbox`.

---

## 1. Gateway assessment for Botswana

Do not assume any gateway supports Botswana merchant accounts, marketplace
splits, or BWP settlements until confirmed in writing by the provider. Verify, at
minimum:

| Requirement | Why it matters | Verify by |
| --- | --- | --- |
| Botswana merchant onboarding | You cannot accept BWP without a local entity/merchant account | Provider's onboarding docs + a test application |
| BWP support (charge + settle) | Some gateways charge BWP but settle USD/ZAR | Written confirmation |
| Card + mobile money | Mobile money (e.g. local wallets) is expected by many clients | Provider feature matrix |
| **Marketplace / split payments** | Providers are separate sellers; the platform takes commission | Contract; "connected accounts" or "sub-merchants" |
| **Payouts to Botswana bank accounts** | Providers must actually get paid | Payout country/currency matrix |
| Refunds + partial refunds via API | Required by the cancellation policy | API docs |
| Disputes/chargebacks workflow | Needed for the disputes desk | Provider docs |
| Escrow/hold-and-release capability | Only if you intend to withhold funds until session completion | Written confirmation + regulatory counsel |

> ⚠️ **Legal warning.** Holding client funds and releasing them after service
> delivery may constitute a payment service requiring authorisation in Botswana
> (Bank of Botswana / NBFIRA regimes). Do **not** describe ordinary payment
> processing as "escrow", and do not implement hold-and-release until counsel
> confirms the structure and any licence requirements. The current design
> charges at booking time and refunds per policy — the simplest lawful model.

**Recommended path:** launch with a card/mobile-money gateway that supports
Botswana merchants and manual provider payouts recorded in
`provider_payouts`. Move to automated payouts/marketplace splits only once a
provider confirms support and the commercial terms are agreed.

---

## 2. How payments work in this codebase

```
client → booking-create (Edge Function)
           ├─ re-quotes everything server-side (DB prices + Routes API)
           ├─ create_booking RPC (transactional, conflict-proof)
           ├─ gateway.createIntent(...)
           └─ payments row (status: created)
                         │
       client completes payment on the gateway's secure UI
                         │
gateway → payment-webhook (signature verified, idempotent)
           ├─ payments.status = captured (only if currently created/authorized/failed)
           └─ booking → pending_approval (approval mode) or confirmed (instant)
```

Refunds flow through `booking-actions`:

| Trigger | Refund |
| --- | --- |
| Provider declines | 100% (always) |
| Provider/platform cancels (safety, suspension) | 100% |
| Client cancels ≥ full-refund window | 100% |
| Client cancels inside partial window | policy % (default 50%) |
| Client cancels inside the late window | 0% |
| Dispute upheld by admin | outcome recorded on `disputes`, refund issued via the adapter |

Guarantees enforced in code:

- **Signature verification** — `parseWebhook` throws on a bad signature;
  the function returns 401 and changes nothing.
- **Idempotency** — events are keyed by `last_event_id`; a replayed event
  short-circuits. Captures are only applied to rows in
  `created`/`authorized`/`failed` states.
- **No client trust** — a booking is never marked paid from a client message.
  The mobile success screen only refetches server state.
- **No card data** — raw PAN/CVV never reach our servers; tokenisation is the
  gateway's responsibility.

---

## 3. Wiring a live gateway

1. Implement `PaymentGatewayAdapter` in
   `supabase/functions/_shared/payments.ts`
   (`createIntent`, `refund`, `parseWebhook`).
2. Add it to `getGateway()` and set the secret
   `PAYMENT_PROVIDER=<adapter-name>`.
3. Point the gateway's webhook URL at
   `https://<project>.supabase.co/functions/v1/payment-webhook`.
4. Store the webhook secret as an Edge Function secret; verify it inside
   `parseWebhook`.
5. Test with the gateway's sandbox: capture, failure, refund, partial refund,
   duplicate webhook delivery, out-of-order events.
6. Only then set `EXPO_PUBLIC_SANDBOX_MODE=false` and remove the banner.

Nothing else in the codebase changes: booking states, refunds, ledger rows, and
payout records are gateway-agnostic.

---

## 4. Fees, commission and payout records

- Commission: `platform_settings.commission_bps` (default 1500 = 15%), applied
  to `total_minor − tax_minor` at booking creation and stored on the booking as
  `commission_minor` — so later rate changes never rewrite history.
- Booking fee: flat `booking_fee_minor` (default P20), shown to the client
  before payment.
- Tax: `tax_rate_bps` (default 1400 = 14% Botswana VAT — **confirm with your tax
  adviser**), shown as its own line item.
- Promo codes: server-validated (`validate_promo`) with expiry, global usage
  limits, and per-user limits; redemptions are recorded.
- Payouts: `payouts-run` aggregates completed bookings per provider per period
  into `provider_payouts` (gross − commission − refunds + adjustments = net).
  Re-running the same period is idempotent. Transfers themselves happen through
  the gateway/bank process you configure; record the reference on the payout row.

Providers see their own ledger in the app (Earnings & payouts); admins see
everything in the dashboard.

---

## 5. Failure handling

| Failure | Behaviour |
| --- | --- |
| Client abandons payment | Booking stays `pending_payment`; `expire_stale_bookings()` releases the slot after 30 minutes |
| Card declined | `payment.failed` webhook → payment `failed`, booking `expired`, slot released, client notified |
| Webhook never arrives | Sweeper expires the unpaid booking; reconcile manually from the gateway dashboard using `gateway_intent_id` |
| Duplicate webhook | Ignored via `last_event_id` |
| Refund fails | `refunds.status = failed`, surfaced to admins in the dashboard for manual processing |
| Chargeback | Admin records the dispute outcome; adjust the provider payout with `adjustments_minor` |

---

## 6. Go-live checklist

- [ ] Written confirmation of Botswana merchant + BWP settlement support.
- [ ] Marketplace/payout capability confirmed (or manual payouts accepted).
- [ ] Webhook secret set and signature verification tested with a forged payload
      (must return 401 and change nothing).
- [ ] Duplicate delivery tested end-to-end.
- [ ] Refund paths tested for all four cancellation outcomes.
- [ ] Reconciliation query run against `payments` vs the gateway dashboard.
- [ ] PCI/SAQ scope confirmed with the gateway (we never touch card data).
- [ ] Legal review of refund policy, consumer protection and tax treatment.
- [ ] Payout arrangement documented in the provider agreement.
