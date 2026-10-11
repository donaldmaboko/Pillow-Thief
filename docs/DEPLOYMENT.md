# Pillow Thief — Deployment Guide

## 1. Environments

| Environment | Backend | Mobile | Admin |
| --- | --- | --- | --- |
| **Development** | local Supabase + seed data | dev build (`expo run:ios/android`) | `npm run dev` |
| **Staging** | dedicated Supabase project | EAS internal distribution build | Vercel preview / staging host |
| **Production** | dedicated Supabase project | App Store + Google Play | production host |

Never share a Supabase project between environments. Never run `seed.sql`
outside development.

---

## 2. Backend deployment (Supabase)

```bash
supabase link --project-ref <staging-or-prod-ref>

# 1. Review what will be applied
supabase db diff --schema public        # optional sanity check
supabase migration list

# 2. Apply migrations (never edit applied migrations; add new ones)
supabase db push

# 3. Deploy every Edge Function
supabase functions deploy booking-quote
supabase functions deploy booking-create
supabase functions deploy payment-webhook --no-verify-jwt   # gateway calls it
supabase functions deploy sandbox-gateway                   # staging/dev only
supabase functions deploy booking-actions
supabase functions deploy admin-verification
supabase functions deploy payouts-run
supabase functions deploy push-notify
supabase functions deploy account-delete

# 4. Secrets per environment
supabase secrets set \
  SANDBOX_WEBHOOK_SECRET=<32+ random bytes> \
  PAYMENT_PROVIDER=sandbox \
  GOOGLE_MAPS_SERVER_KEY=<server key>
```

Notes:

- `payment-webhook` is called by the gateway, so JWT verification is disabled —
  **signature verification inside the function is mandatory** and is already
  implemented.
- `push-notify` requires `service_role` in the Authorization header
  (enforced in code).
- Hosted projects have PostGIS, pgcrypto, uuid-ossp and btree_gist available;
  migration 1 enables them.
- Schedule the expiry sweeper (pg_cron):
  ```sql
  select cron.schedule('expire-unpaid-bookings', '5 minutes',
    $$select public.expire_stale_bookings()$$);
  ```
- Create an admin user, then set the role once via the SQL editor:
  ```sql
  update public.profiles set role = 'admin' where id = '<user-uuid>';
  ```
  (Client-side role changes are blocked by triggers — this is intentional.)

---

## 3. Admin dashboard deployment

Any Node host works (Vercel, Netlify, a container on Fly.io/Render).

```bash
cd apps/admin
npm ci
npm run build
npm start                # or deploy apps/admin to your host of choice
```

Environment variables (set on the host, not in the repo):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     # server-side only
```

Hardening checklist:

- [ ] HTTPS only; HSTS enabled.
- [ ] Access restricted to admin accounts (already enforced server-side).
- [ ] Consider IP allow-listing or SSO (e.g. Google Workspace) at the host/proxy.
- [ ] Rotate the service-role key if it has ever been exposed.
- [ ] Enable host-level audit logging in addition to `audit_logs`.

---

## 4. Mobile release

### 4.1 Identifiers and signing

| Item | Value |
| --- | --- |
| Expo slug | `pillow-thief` |
| iOS bundle ID | `app.pillowthief.mobile` |
| Android package | `app.pillowthief.mobile` |
| URL scheme | `pillowthief` |
| Version | `apps/mobile/app.json` → `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode` |

```bash
cd apps/mobile
npm i -g eas-cli
eas login
eas build:configure

# Staging / internal testing
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Production
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

Credentials: let EAS manage the iOS distribution certificate + provisioning
profile, and the Android upload keystore (**back the keystore up** — losing it
means you can never update the same Play listing). Document who holds the Apple
Developer and Google Play account credentials.

### 4.2 Pre-submission checks

- [ ] `EXPO_PUBLIC_SANDBOX_MODE=false` and a live gateway configured.
- [ ] Google Maps keys in `app.json` are the **production-restricted** keys.
- [ ] `npx expo prebuild --clean` run after any `app.json` key change.
- [ ] Privacy nutrition labels / Data safety form completed honestly
      (location, contacts/messages content, identifiers, purchases).
- [ ] Account deletion is reachable in-app (required by Apple 5.1.1(v)) —
      Settings → Delete my account.
- [ ] Age rating 18+; no sexual content claims; review notes explain that the
      service is non-sexual professional companionship.
- [ ] Health/medical claims absent from all copy (App Store 1.4.1 / Play policy).
- [ ] Screenshots and store text match the shipped UI (see STORE_LISTING.md).
- [ ] Test account credentials supplied in the review notes (client + provider
      + admin demo accounts on staging).

---

## 5. Backups and recovery

| Asset | Method | Frequency | Retention | Restore drill |
| --- | --- | --- | --- | --- |
| Postgres (production) | Supabase automated daily backups (PITR on paid plans) | daily / continuous | 7–30 days per plan | quarterly restore into a scratch project |
| Storage buckets | Supabase storage backups + `supabase storage cp --recursive` | weekly | 90 days | restore selected objects |
| Edge Functions & migrations | this Git repository | every change | forever | redeploy from a tag |
| Environment secrets | password manager (owner + one deputy) | on rotation | versioned | re-set `supabase secrets` |
| Android keystore | encrypted archive + password manager | once + on rotation | forever | required for any Play update |
| Apple certificates | EAS-managed + password manager | on rotation | forever | re-issue via EAS |

Recovery runbook:

1. Restore the database to a scratch project; validate with
   `scripts/verify_backend.py`-style queries and row counts.
2. Point a staging deployment at the restored project; smoke-test login,
   discovery, booking, and payment webhook replay.
3. Cut over production; re-run `supabase secrets set` (secrets are not part of
   database backups).
4. Re-enable the pg_cron sweeper and verify Realtime publication is intact.
5. Post-incident: document the cause, the data window affected, and any
   user notification obligations under the Data Protection Act.

---

## 6. Release checklist

See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for the full pre-launch list.

---

## 7. Rollback

| Change | Rollback |
| --- | --- |
| Edge Function | redeploy the previous commit (`supabase functions deploy <name>` from a tag) |
| Admin dashboard | redeploy the previous build (host rollback) |
| Migrations | forward-only: write a corrective migration. Test restores using backup/PITR — do **not** edit applied migrations |
| Mobile | Play/App Store staged rollout halt; ship a patch release |
| Feature flags | `platform_settings.bookings_enabled`, `maintenance_mode` let you stop new bookings without a deploy |
