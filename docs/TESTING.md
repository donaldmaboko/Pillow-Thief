# Pillow Thief — Testing Guide

## 1. Test suites in this repository

| Suite | Command | What it proves |
| --- | --- | --- |
| Shared domain unit tests | `cd packages/shared && npm test` | Money math, status machine, pricing/commission, cancellation tiers, consent compatibility (24 assertions) |
| Type safety | `npx tsc --noEmit` in `packages/shared`, `apps/mobile`, `apps/admin` | Strict typing across all three codebases |
| Backend rule verification | `/tmp/ptvenv/bin/python scripts/verify_backend.py` | 28 assertions against **real PostgreSQL**: double-booking exclusion, availability windows, server-side price authority, privilege-escalation guards, RLS isolation, promo limits, review eligibility, audit logging |
| Edge Function tests (Deno) | `cd supabase/functions && deno task test` | Webhook signature verification (valid / forged / tampered / malformed), gateway selection refuses unwired providers, routing fallback is labelled as an estimate (8 assertions) |
| Edge Function type check | `deno check --config deno.json */main.ts` | All nine functions compile under strict Deno/TypeScript |
| Mobile bundle check | `cd apps/mobile && npm run bundle:check` | Metro/Hermes produce a production bundle — catches unresolved imports and missing assets that type-checking cannot |
| Admin production build | `cd apps/admin && npx next build` | Compiles, type-checks and renders all routes |

### What the Edge Function suite asserts

```
sandbox webhook: valid signature is accepted
sandbox webhook: forged signature is rejected
sandbox webhook: tampered payload is rejected
sandbox webhook: malformed event object is rejected
gateway selection: sandbox mode resolves the sandbox adapter
gateway selection: unconfigured provider fails loudly
routeEstimate: falls back to a labelled estimate without an API key
```

### What the backend harness asserts (highlights)

```
PASS  overlapping booking rejected by exclusion constraint
PASS  slot outside weekly window is unavailable
PASS  blocked exception day reported unavailable
PASS  create_booking returns server-computed total        (client-supplied price ignored)
PASS  booking an unapproved provider is blocked
PASS  client cannot escalate own role to admin
PASS  provider cannot alter own verification state
PASS  provider cannot unpublish/publish at will
PASS  third party cannot modify a provider row (RLS filters)
PASS  unrelated user sees no bookings via RLS
PASS  clients cannot write payment rows
PASS  duplicate review for same booking rejected
PASS  booking changes are audit-logged
```

Re-run it after **every** migration change — it caught three real bugs during
development (a PL/pgSQL loop-target error, `round(double precision, int)` not
existing in PostgreSQL, and missing UUID casts in the seed).

---

## 2. Manual QA — client journey (run on iOS **and** Android)

1. **Register** → age confirmation required; terms + privacy must be accepted.
2. Verify email link → sign in.
3. **Home** → featured providers load; the upcoming-booking card appears only
   when a real booking exists.
4. **Discover** → filter by city, arrangement, price, sort by rating.
5. **Explore Map** → markers for verified providers; tap → preview sheet →
   open profile; deny location permission → manual search still works.
6. **Provider profile** → services, prices, house-call areas, genuine reviews.
7. **Book** → service → duration → date/time (only genuinely available slots are
   returned by the backend) → meeting arrangement → summary shows the
   server-computed breakdown (session, travel, fee, tax, total).
8. **Pay** (sandbox) → booking moves to `pending_approval` or `confirmed`.
9. **Consent checklist** → save boundaries for both parties.
10. **Message** the provider; confirm timestamps and read receipts.
11. **Cancel** inside each refund window → verify the refund % shown matches the
    stored policy and a `refunds` row is created.
12. Complete a session → **review** (only after `completed`) → duplicate review
    is rejected; review appears on the profile with aggregated rating.
13. **Report** a user → appears in the admin moderation queue.
14. **Block** a user → messaging between them is refused.
15. **Delete account** → profile deactivated, future bookings cancelled, sign-out.

## 3. Manual QA — provider journey

1. Apply (legal name, DOB, bio, languages, meeting options, base price,
   boundaries). Application lands with status `pending`.
2. Admin approves → role becomes `provider`, profile provisioned but
   **unpublished**.
3. Add services with per-duration prices; set weekly availability + a day off;
   configure a service area with travel fee + max distance.
4. Publish → appears in discovery for clients **only** after verification.
5. Receive a request → accept (confirmed) or decline (client refunded 100%).
6. Mark session complete → earnings reflect gross − commission − refunds.
7. Add an availability exception → the slot disappears from client calendars.

## 4. Manual QA — admin journeys

1. Sign in as admin; non-admin accounts are rejected.
2. Overview metrics match direct SQL counts (`select count(*) …`).
3. Approve / reject / request-more-info an application → audit log entries exist.
4. Suspend a provider → disappears from discovery immediately; reinstate restores.
5. Bookings list filter by status; totals and commission match the ledger.
6. Generate payouts for a period; re-running is idempotent.
7. Resolve a report and a dispute with notes.

## 5. Security test checklist

- [ ] Forge a webhook POST without a valid signature → 401, nothing changes.
- [ ] Replay a valid webhook → recorded once (`last_event_id`).
- [ ] Client PATCH on `payments`/`refunds`/`payouts` → denied by RLS.
- [ ] Client UPDATE `profiles.role` → trigger error.
- [ ] Provider UPDATE `verification`/`published` → trigger error.
- [ ] Unrelated user SELECT `bookings` → 0 rows.
- [ ] Read another user's `booking_locations` (exact address) → 0 rows.
- [ ] Read `verification-documents` bucket as another user → denied.
- [ ] Submit a review for a non-completed booking → rejected by policy.
- [ ] Insert a message while blocked → rejected.
- [ ] Rate-limit/DoS: flood `booking-quote` → confirm Google quota alerts fire.
- [ ] Mobile: ensure only `EXPO_PUBLIC_*` values are in the JS bundle
      (`npx expo export` then grep for `service_role`).

## 6. Performance checks

- Provider list: 60 rows per query, indexed discovery view (`city`,
  `verification='verified'`, `published`).
- Availability: `available_slots` is database-side; no N+1 per provider.
- Messaging: single Realtime channel per conversation, 200-message page.
- Map: markers limited to the current search result set; region changes re-query
  rather than loading every provider.

## 7. Device matrix (minimum)

| Platform | Devices |
| --- | --- |
| iOS | iPhone SE (small), iPhone 15/16 (current), iPad (layout sanity) |
| Android | Small (5.0"), mid (6.1"), large (6.7"+), one low-end device for slow-network testing |
| Networks | Wi-Fi, 4G, and a throttled "Slow 3G" profile via the dev menu |
| Modes | Light mode, dark mode, largest system font size |

## 8. Before release

- [ ] All three test suites green.
- [ ] Manual journeys completed on iOS and Android.
- [ ] Security checklist complete with evidence (screenshots/queries).
- [ ] Google Maps verified with production-restricted keys.
- [ ] Payment gateway sandbox journey verified; live keys only after PAYMENTS.md
      sign-off.
- [ ] Bootstrap admin password changed (no `Password123!` login works) and no
      other demo accounts exist.
