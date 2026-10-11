# Pillow Thief — Development Guide

## 1. Architecture

```
┌──────────────────────┐        ┌───────────────────────┐
│  Mobile (Expo/RN)    │        │  Admin (Next.js 16)   │
│  iOS + Android       │        │  responsive web       │
└─────────┬────────────┘        └───────────┬───────────┘
          │ anon key + user JWT             │ user JWT (admin) / service role (server)
          ▼                                 ▼
┌──────────────────────────────────────────────────────────┐
│                       Supabase                           │
│  Postgres + RLS + RPCs        Edge Functions             │
│  Auth · Storage · Realtime    (payments, quotes, push)   │
└──────────────────────────────────────────────────────────┘
          │
          ├── Payment gateway adapter (sandbox today)
          └── Google Maps Platform (Routes, Places, Geocoding) — server side
```

Three principles drive every decision:

1. **The server is the source of truth.** Prices, travel fees, availability,
   statuses, commission, verification, and permissions are all computed and
   enforced in Postgres or an Edge Function. Clients render; they never decide.
2. **Defence in depth.** A rule is enforced where it is cheapest to break it:
   database constraints (double booking), RLS (row visibility), guard triggers
   (privilege escalation), RPC validation (business rules), UI (affordance).
3. **Privacy by construction.** Legal names, identity documents, exact
   addresses, and payment details live in separate tables/buckets with
   narrower policies than public profile data.

## 2. Repository map

| Path | Contents |
| --- | --- |
| `packages/shared/src/bookingStatus.ts` | Status machine, blocking statuses, labels |
| `packages/shared/src/money.ts` | Integer minor-unit money helpers |
| `packages/shared/src/pricing.ts` | Quote composition, commission, travel fees |
| `packages/shared/src/cancellation.ts` | Refund tiers and platform floor |
| `packages/shared/src/consent.ts` | Consent checklist + compatibility rules |
| `packages/shared/src/schemas.ts` | Zod schemas shared by app + server |
| `supabase/migrations/*` | Schema, policies, RPCs — the authoritative backend |
| `supabase/functions/*` | Server-side operations with secrets |
| `apps/mobile/src/theme` | Design tokens + light/dark themes |
| `apps/mobile/src/components` | Reusable UI kit |
| `apps/mobile/src/lib/queries.ts` | All TanStack Query data access |
| `apps/admin/src/app/(dashboard)` | Admin screens + server actions |

## 3. Conventions

- **TypeScript strict everywhere**; `noUncheckedIndexedAccess` in the shared
  package and mobile app.
- **Money** is always `integer` minor units (thebe). Never `float`, never
  strings parsed from user input without validation. Display formatting only
  through `formatMoney`.
- **Time** is stored UTC and rendered in `Africa/Gaborone`. Availability is
  evaluated in local time (weekly windows use local weekday + minutes).
- **Statuses** come from `BOOKING_STATUSES`; transitions must satisfy
  `canTransition()` in the shared package *and* `assert_booking_transition()`
  in Postgres. Add new transitions in both places with a test.
- **Components** are presentational. Data access lives in `src/lib/queries.ts`
  (mobile) or server actions (admin). Screens compose both.
- **Errors** use `PillowError`/`ApiError` codes so the UI can show actionable
  messages ("That time was just taken") rather than raw text.
- **Naming**: `snake_case` in SQL, `camelCase` in TS, `kebab-case` file names
  for docs, `PascalCase` for components.

## 4. Change workflow

1. **Schema change** → new file in `supabase/migrations/` (never edit applied
   migrations in a deployed environment). Add RLS policies in the same
   migration. Then run `scripts/verify_backend.py`.
2. **Business rule change** → shared package first (with a Vitest test), then
   mirror it in SQL/Edge Function if it is security-relevant.
3. **UI change** → reuse `src/components`; add a new component when a pattern
   repeats three times.
4. **Anything touching money, identity, or location** → review the RLS
   policies in `20261011000012_rls.sql` and add an assertion to the
   verification harness.

## 5. Local workflows

```bash
# Database + functions
supabase start
supabase db reset                       # schema + DEV seed
supabase functions serve --env-file supabase/.env.local

# Backend rule verification (fast, real Postgres)
/tmp/ptvenv/bin/python scripts/verify_backend.py

# Shared domain tests
cd packages/shared && npm test && npx tsc --noEmit

# Mobile
cd apps/mobile && npx tsc --noEmit && npx expo start

# Admin
cd apps/admin && npm run dev && npx tsc --noEmit
```

## 6. Adding a payment provider

Implement `PaymentGatewayAdapter` in
`supabase/functions/_shared/payments.ts`:

```ts
export const acmeGateway: PaymentGatewayAdapter = {
  name: 'gateway',
  async createIntent(params) { /* returns { intentId, clientPayload } */ },
  async refund(intentId, amountMinor, reason) { /* returns { refundId, status } */ },
  parseWebhook(rawBody, signature) { /* verify signature, return typed event */ },
}
```

Then add it to `getGateway()` and set `PAYMENT_PROVIDER`. Nothing else changes:
booking state transitions and refund records are already gateway-agnostic. See
[PAYMENTS.md](./PAYMENTS.md) for the compliance checklist that must be satisfied
first.

## 7. Adding a screen

1. Create the file under `apps/mobile/app/...` following the existing route tree.
2. Fetch data with a hook in `src/lib/queries.ts` (query key: `['entity', id]`).
3. Render loading → `CardSkeleton`, empty → `EmptyState`, error → `ErrorState`,
   success → content. Every screen must handle all four states.
4. Guard private screens: the `(app)` group redirects unauthenticated users;
   the `(provider)` group requires a provider profile.

## 8. Known limitations (documented, not hidden)

- **Sandbox payments** until a Botswana-capable gateway is configured; the UI
  labels this and the sandbox gateway refuses to run when
  `PAYMENT_PROVIDER != sandbox`.
- **Travel estimates** fall back to haversine × 1.3 when
  `GOOGLE_MAPS_SERVER_KEY` is absent, and the response flags
  `degraded_travel: true` so the UI says "estimate".
- **Place autocomplete** is wired through the server (`GOOGLE_MAPS_SERVER_KEY`);
  the mobile app currently accepts an area + free-text meeting label in place of
  a Places Autocomplete widget. Enabling the widget requires a key restricted to
  the app's bundle ID — see GOOGLE_MAPS.md.
- **Payouts** are recorded in the ledger and transferred manually until a
  marketplace-capable gateway or bank integration is confirmed.
- **PostGIS shims**: the verification harness substitutes text-based geometry
  when PostGIS is unavailable; production Supabase projects have PostGIS.
