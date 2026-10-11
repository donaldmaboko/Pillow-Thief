# Pillow Thief

**Steal a cuddle. Keep the comfort.**

Real people. Genuine connection. Just cuddles.

Pillow Thief is a professional cuddling and non-sexual companionship platform
for adults (18+), launching in **Gaborone, Botswana** with prices in **BWP** and
local time in **Africa/Gaborone**. It connects clients seeking comfort,
relaxation and human connection with verified professional cuddle providers.

---

## What is in this repository

| Component | Stack | Location |
| --- | --- | --- |
| Mobile app (iOS + Android) | React Native / Expo SDK 57, Expo Router, TypeScript, TanStack Query, Zustand, React Hook Form + Zod, React Native Maps | `apps/mobile` |
| Admin dashboard (responsive web) | Next.js 16, React 19, TypeScript | `apps/admin` |
| Backend | Supabase: PostgreSQL, Auth, RLS, Storage, Realtime, Edge Functions (Deno) | `supabase/` |
| Shared domain package | TypeScript + Zod + Vitest | `packages/shared` |
| Documentation | Setup, Maps, Payments, Security, Testing, Deployment, Release, Legal templates, Store listing | `docs/` |
| Backend verification harness | Applies migrations to a real PostgreSQL and asserts 28 rules | `scripts/verify_backend.py` |

---

## Feature summary

**Clients** — verified provider discovery (list + interactive Google Map),
search and filters, transparent pricing, booking with live availability,
meeting-arrangement choice (provider travels / client visits / public place),
secure payment, consent & boundaries checklist, in-app messaging, reviews,
favourites, notifications, safety centre with reporting and blocking, account
deletion.

**Providers** — application and verification workflow, profile and services with
per-duration pricing, weekly availability with exceptions, service areas with
per-km travel fees and maximum travel distance, booking requests (accept /
decline with automatic refunds), earnings with commission and payout records,
review responses.

**Administrators** — operations overview with genuine metrics, provider
verification queue, suspend/reinstate, booking oversight, payment/refund/payout
ledger, payout generation, moderation queues for reports and disputes, platform
settings (commission, booking fee, tax), and append-only audit logs.

---

## Engineering highlights

- **Double-booking is impossible by construction** — a PostgreSQL
  `EXCLUDE USING gist` constraint over the provider's time range, for every
  status that occupies the calendar.
- **The server decides money.** Prices, travel fees, tax, commission and totals
  are computed from database rows and Google Routes API results. Client-supplied
  prices are ignored by design.
- **Payments cannot be faked.** Only the signature-verified, idempotent webhook
  can capture a payment or advance a booking past `pending_payment`.
- **Privilege escalation is blocked at the database.** Guard triggers reject
  changes to `role`, `verification`, `published` and rating fields from any
  non-service role; RLS then isolates rows between users.
- **Location privacy by construction.** Discovery exposes approximate provider
  locations only; exact meeting points are readable solely by the booking
  participants and admins.
- **Consent is first-class.** Per-booking checklists for both parties with an
  explicit ongoing-consent acknowledgement, plus reporting, blocking and
  safety-stopping that never penalises the person who stops a session.

---

## Quick start

```bash
# 1. Backend
supabase start && supabase db reset        # schema + migrations + DEV seed
supabase functions serve --env-file supabase/.env.local

# 2. Mobile
cd apps/mobile && npm install
cp .env.example .env                        # add your Supabase URL + anon key
npx expo prebuild --clean && npx expo run:ios    # or: run:android

# 3. Admin
cd apps/admin && npm install
cp .env.example .env.local                  # add Supabase URL + anon key + service role key
npm run dev                                 # http://localhost:3100
```

Full instructions: [docs/SETUP.md](./docs/SETUP.md).

---

## Verify it works

```bash
# domain logic (24 assertions)
cd packages/shared && npm test

# edge functions (payment webhook signature path, routing fallback)
cd supabase/functions && deno task test
cd supabase/functions && deno check --config deno.json */main.ts

# type safety + bundling
cd packages/shared && npx tsc --noEmit
cd apps/mobile   && npx tsc --noEmit && npm run bundle:check
cd apps/admin    && npx next build

# backend rules against a real PostgreSQL (28 assertions)
python3 -m venv /tmp/ptvenv && /tmp/ptvenv/bin/pip install pgserver
/tmp/ptvenv/bin/python scripts/verify_backend.py
```

---

## Configuration you must supply

The application is complete and honest about what needs configuring. Each item
is documented with step-by-step instructions:

| Requirement | Status | Guide |
| --- | --- | --- |
| Supabase project (Postgres/Auth/Storage) | required | [SETUP.md](./docs/SETUP.md) |
| Google Maps API keys (5 APIs, restricted per platform) | required for live maps | [GOOGLE_MAPS.md](./docs/GOOGLE_MAPS.md) |
| Payment gateway with Botswana merchant support | **sandbox adapter ships; live gateway required for real money** | [PAYMENTS.md](./docs/PAYMENTS.md) |
| Expo push notification credentials | optional (in-app notifications work without it) | [DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| Legal review of published policies | required before launch | [legal/](./docs/legal) |

**Nothing in this repository claims to be live when it is not.** Sandbox
payments are labelled in the UI, missing map keys show an explicit notice, and
travel estimates declare themselves as estimates.

---

## Documentation

- [SETUP.md](./docs/SETUP.md) — install, local development, env reference, troubleshooting
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) — architecture, conventions, change workflow
- [GOOGLE_MAPS.md](./docs/GOOGLE_MAPS.md) — APIs, key restrictions, privacy rules, testing
- [PAYMENTS.md](./docs/PAYMENTS.md) — Botswana gateway assessment, flows, go-live checklist
- [SECURITY.md](./docs/SECURITY.md) — trust boundaries, controls, data-protection mapping
- [TESTING.md](./docs/TESTING.md) — suites, manual journeys, security tests, device matrix
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) — environments, stores, secrets, backups, rollback
- [RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) — everything to tick before launch
- [STORE_LISTING.md](./docs/STORE_LISTING.md) — listing copy and asset plan
- [legal/](./docs/legal) — privacy policy, terms of service, provider agreement (templates for legal review)

---

## Safety and positioning

Pillow Thief is for adults aged 18 and over. All services are non-sexual and
consent-first: boundaries are agreed before each session, consent is ongoing, and
either participant may stop at any time without penalty. The platform prohibits
sexual solicitation, coercion, harassment, threats, stalking, fraud, unauthorised
recording and disclosure of private information, and provides reporting,
blocking and moderation workflows. Pillow Thief is not a medical or therapeutic
service and does not claim to treat any condition.

---

## Project status

Phase 1–2 complete and verified: shared domain package, database schema with RLS,
Edge Functions, mobile application, and administrative dashboard, all building
and type-checking, with automated backend rule verification and documentation.
Operational readiness depends on the external credentials listed above and on the
business completing the pre-launch items in
[RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md).

## License

Copyright belongs to the project owner unless a separate licence is published.
No permission to redistribute or commercially reuse the software is granted
unless expressly authorised.
