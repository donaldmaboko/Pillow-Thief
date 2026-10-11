# Pillow Thief — Release Checklist

Copy this into your project tracker. Every item must be ticked with evidence
(a command output, a screenshot, or a signed document) before launch.

## 1. Code quality gates

- [ ] `cd packages/shared && npm test` → 24/24 passing
- [ ] `cd packages/shared && npx tsc --noEmit` → clean
- [ ] `cd apps/mobile && npx tsc --noEmit` → clean
- [ ] `cd apps/admin && npx build` → clean (`npx next build`)
- [ ] `python scripts/verify_backend.py` → 28/28 passing
- [ ] No TODO/FIXME left in security-relevant code paths
- [ ] `git log` reviewed; no secrets, keys or real personal data committed
- [ ] Dependency audit reviewed (`npm audit --omit=dev` in each app) and
      high/critical issues resolved or documented

## 2. Backend

- [ ] Production Supabase project created and migrations pushed
- [ ] All nine Edge Functions deployed; `payment-webhook` has
      `--no-verify-jwt` **and** signature verification enabled
- [ ] Secrets set for the environment (webhook secret, gateway, Google server key)
- [ ] pg_cron sweeper scheduled for `expire_stale_bookings()`
- [ ] Admin user created; `profiles.role='admin'` set; MFA considered
- [ ] Realtime publication includes `messages` and `notifications`
- [ ] Storage buckets exist with the private `verification-documents` bucket
- [ ] RLS enabled on every table (`select relname from pg_class where relrowsecurity = false and relkind='r' and relnamespace = 'public'::regnamespace;` → no rows)
- [ ] Automated daily backups enabled; one restore rehearsed
- [ ] `platform_settings` reviewed: commission_bps, booking_fee_minor, tax_rate_bps
- [ ] Demo seed data absent from production

## 3. Payments

- [ ] Gateway contract signed; Botswana + BWP + payouts confirmed in writing
- [ ] Live keys stored as Edge Function secrets (never in the repo)
- [ ] Webhook endpoint registered with the gateway
- [ ] Forged-signature and duplicate-delivery tests passed
- [ ] Full refund, partial refund, decline and cancellation-refund paths tested live (small amounts)
- [ ] Reconciliation between `payments`/`refunds` and the gateway dashboard
- [ ] Payout process documented and tested with one real provider transfer
- [ ] Tax treatment of the booking fee and commission confirmed with an adviser

## 4. Google Maps

- [ ] Five APIs enabled, billing active, budget alerts configured
- [ ] Android key restricted to package + signing SHA-1
- [ ] iOS key restricted to bundle ID
- [ ] Server key restricted to Routes/Geocoding/Places and stored as a secret
- [ ] Dev build verified on a physical Android device **and** iPhone
- [ ] Marker coverage matches published providers; suspended providers absent
- [ ] Degraded (no-key) behaviour verified and clearly labelled
- [ ] Privacy policy reflects location usage

## 5. Mobile apps

- [ ] `app.json` production keys and version/build numbers set
- [ ] `EXPO_PUBLIC_SANDBOX_MODE=false`
- [ ] Release build signed with production credentials (EAS)
- [ ] Push notifications configured (Expo project + `expo_push_token` stored)
- [ ] Deep link `pillowthief://auth-callback` verified for email confirmation and
      password reset
- [ ] Account deletion reachable in-app (Apple 5.1.1(v))
- [ ] Dark mode, small screens, large font sizes verified
- [ ] Offline/slow-network behaviour: booking never appears confirmed without
      server confirmation
- [ ] Crash/error monitoring wired (e.g. Sentry) and verified

## 6. Safety, consent and moderation readiness

- [ ] Consent checklist copy reviewed by counsel/product
- [ ] Report → moderation queue → resolution → audit log verified end to end
- [ ] Blocking immediately stops messaging and booking requests
- [ ] Suspension removes a provider from discovery instantly
- [ ] Safety centre copy confirmed accurate (no claims of contacting emergency services)
- [ ] Support process defined: who answers tickets, target first response time
- [ ] Dispute process defined with refund authority levels
- [ ] Trusted-contact and check-in features labelled as described

## 7. Legal and compliance

- [ ] Privacy policy, terms of service, provider agreement and cancellation
      policy reviewed by Botswana counsel and published with public URLs
- [ ] Data controller registration/notification obligations assessed
- [ ] Consumer protection disclosures verified (fees, refunds, cancellation)
- [ ] Provider classification (contractor vs employee) confirmed
- [ ] Insurance/liability position confirmed for in-person services
- [ ] Age-verification approach confirmed (18+ attestation + ID at provider
      verification; document the rationale)
- [ ] Advertising/marketing claims reviewed (no health claims, no user-count
      claims we cannot substantiate)
- [ ] Apple/Google policy review completed for both listings

## 8. Operations

- [ ] Monitoring: Edge Function error rate, webhook failures, payment failures
- [ ] Alerts routed to a human with a defined response window
- [ ] Incident response runbook tested (see SECURITY.md §6, DEPLOYMENT.md §5)
- [ ] Backup/restore drill completed in the last 90 days
- [ ] Support mailboxes and phones staffed for launch day
- [ ] Rollback plan rehearsed (functions, admin, mobile patch)

## 9. Launch readiness sign-off

| Area | Owner | Date | Evidence |
| --- | --- | --- | --- |
| Engineering | | | test + build outputs |
| Security/privacy | | | security checklist |
| Payments/finance | | | gateway contract + reconciliation |
| Legal | | | signed policies |
| Operations/support | | | staffing + runbooks |
| Product/business | | | launch decision |
