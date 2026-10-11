# Pillow Thief — Installation & Setup

This guide takes you from a clean checkout to a running stack: database,
Edge Functions, mobile app, and admin dashboard.

> **Status honesty:** everything in this repo is real, working code. The
> payment provider is a **labelled sandbox** until you configure a
> Botswana-capable gateway (see [PAYMENTS.md](./PAYMENTS.md)), and Google Maps
> requires your own API keys (see [GOOGLE_MAPS.md](./GOOGLE_MAPS.md)). The app
> tells users when either is in a simulated/degraded state.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 (22 recommended) | Expo SDK 57 and Next 16 both require 20+ |
| npm | ≥ 10 | workspaces are used at the repo root |
| Supabase CLI | ≥ 1.180 | `npm i -g supabase` or `brew install supabase/tap/supabase` |
| Docker | recent | required by the Supabase CLI for local development |
| Xcode | 15+ | iOS development builds only |
| Android Studio | recent | Android development builds only |
| JDK | 17 | Android Gradle builds |

---

## 2. Repository layout

```
Pillow-Thief/
├── apps/
│   ├── mobile/          # Expo (React Native) app — iOS, Android
│   └── admin/           # Next.js administrative dashboard
├── packages/
│   └── shared/          # Domain logic + Zod schemas + tests (used by both apps)
├── supabase/
│   ├── migrations/      # Database schema, RLS policies, RPCs (source of truth)
│   ├── functions/       # Edge Functions (payments, quoting, verification, push)
│   └── seed.sql         # DEV-ONLY demonstration data
├── scripts/
│   └── verify_backend.py # Applies migrations to a real PostgreSQL and asserts 28 rules
└── docs/                # This documentation set
```

---

## 3. Backend (Supabase)

### 3.1 Start a local stack

```bash
cd Pillow-Thief
supabase start                 # boots Postgres, Auth, Storage, Realtime, Studio
supabase db reset              # applies supabase/migrations/* then supabase/seed.sql
```

`supabase start` prints your local API URL, anon key, and service-role key.
Copy them into the app env files (below). Local defaults:

```
API URL:            http://127.0.0.1:54321
Studio:             http://127.0.0.1:54323
database:           postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 3.2 Edge Function secrets

```bash
# Generate a strong secret for signing simulated payment webhooks
openssl rand -hex 32

supabase secrets set \
  SANDBOX_WEBHOOK_SECRET=<the value you just generated> \
  PAYMENT_PROVIDER=sandbox \
  GOOGLE_MAPS_SERVER_KEY=<your server-restricted key, or omit to run in estimate mode>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into Edge Functions automatically — never place them in client code.

### 3.3 Serve functions locally

```bash
supabase functions serve --env-file ./supabase/.env.local
```

### 3.4 Database: what the migrations create

- 30 tables, all with Row Level Security enabled.
- A **PostgreSQL exclusion constraint** (`bookings_no_double_booking`) that makes
  overlapping provider bookings physically impossible.
- `create_booking`, `available_slots`, `slot_is_available`,
  `transition_booking`, `provider_accept_booking`, `provider_decline_booking`,
  `client_cancel_booking`, `validate_promo`, `can_review_booking`.
- Guard triggers that stop any client from changing `role`, `verification`,
  `published`, payment status, or platform settings.
- `provider_discovery` view (`security_invoker`) — the only surface used for
  browsing providers. It exposes approximate locations, never home addresses.
- Audit triggers on applications, bookings, payments, refunds, payouts,
  disputes, and platform settings.

### 3.5 Verify the database logic automatically

```bash
python3 -m venv /tmp/ptvenv && /tmp/ptvenv/bin/pip install pgserver
/tmp/ptvenv/bin/python scripts/verify_backend.py
```

This boots a real PostgreSQL, applies every migration plus the seed, and asserts
28 business/security rules (double-booking, availability windows, server-side
pricing, privilege escalation, RLS isolation, promo limits, review eligibility,
audit logging). It is the fastest way to confirm a migration change is safe.

---

## 4. Mobile app

```bash
cd apps/mobile
npm install
cp .env.example .env            # then edit:
#   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your local anon key>
#   EXPO_PUBLIC_SANDBOX_MODE=true

npx expo prebuild --clean       # generates native iOS/Android projects
npx expo run:ios                # or: npx expo run:android
```

**Google Maps requires a development build** (not Expo Go) — see
[GOOGLE_MAPS.md](./GOOGLE_MAPS.md). Without keys the map screen still loads,
shows an explicit "not configured" notice, and provider data (markers list,
distances, travel fees via the server fallback) continues to work.

Type-check:

```bash
npx tsc --noEmit
```

---

## 5. Admin dashboard

```bash
cd apps/admin
npm install
cp .env.example .env.local      # then edit with the same Supabase values + service role key
npm run dev                     # http://localhost:3100
```

Sign in with an account whose `profiles.role = 'admin'`. In local development the
seed creates `admin@pillowthief.local` (see section 6). Non-admin accounts are
rejected both by the dashboard and by every admin Edge Function.

---

## 6. Development accounts (seed data)

`supabase/seed.sql` is **development-only**. Password for all accounts:
`Password123!`

| Email | Role | Purpose |
| --- | --- | --- |
| `admin@pillowthief.local` | admin | Dashboard, verification queue |
| `lerato@pillowthief.local` | client | Books sessions |
| `thabo@pillowthief.local` | provider (verified, published) | Discovery, bookings |
| `naledi@pillowthief.local` | provider (verified, published) | Public-meeting sessions |
| `kabelo@pillowthief.local` | applicant (pending) | Admin verification demo |

Seed data is fictional test data. It is never loaded into staging or production
by the deploy scripts, and the UI labels simulated payments as sandbox.

---

## 7. Environment reference

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | Supabase API endpoint |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | anon key (RLS-protected; safe in the client) |
| `EXPO_PUBLIC_SANDBOX_MODE` | mobile | Shows the "payments are simulated" banner |
| `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` | admin | Same project, dashboard auth |
| `SUPABASE_SERVICE_ROLE_KEY` | admin server, Edge Functions | Privileged operations — **never** ship to a client |
| `SANDBOX_WEBHOOK_SECRET` | Edge Functions | HMAC secret for simulated gateway webhooks |
| `PAYMENT_PROVIDER` | Edge Functions | `sandbox` today; adapter name once a live gateway is wired |
| `GOOGLE_MAPS_SERVER_KEY` | Edge Functions | Routes/Places/Geocoding server calls |

---

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Mobile app shows "Pillow Thief needs its backend configured" | `.env` missing or not restarted — `npx expo start -c` |
| Map screen shows the "Google Maps key not configured" notice | Expected without keys; follow GOOGLE_MAPS.md |
| `supabase db reset` fails on PostGIS | Hosted Supabase has PostGIS pre-enabled; locally it is installed by migration 1 |
| Admin login says "not authorised" | The account's `profiles.role` is not `admin` |
| Edge Function returns `invalid_signature` | `SANDBOX_WEBHOOK_SECRET` is missing/mismatched |
| Booking quote says "live routing unavailable" | `GOOGLE_MAPS_SERVER_KEY` unset — estimates are used and labelled |

---

## 9. Next steps

- [GOOGLE_MAPS.md](./GOOGLE_MAPS.md) — API keys, restrictions, billing.
- [PAYMENTS.md](./PAYMENTS.md) — gateway assessment for Botswana + go-live steps.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — architecture and conventions.
- [TESTING.md](./TESTING.md) — test suites and manual QA journeys.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — staging/production, stores, backups.
