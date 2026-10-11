# Pillow Thief — Security & Privacy Model

## 1. Trust boundaries

| Actor | Credential | Can do | Cannot do |
| --- | --- | --- | --- |
| Anonymous | anon key | Read `provider_discovery`, public provider profiles/services, platform settings | Read anything else; write anything |
| Client (JWT) | user JWT | Own profile, own bookings, own payments (read), search, book, message participants, review completed bookings | Set prices/statuses/verification/roles; read others' data |
| Provider (JWT) | user JWT + provider row | Services, availability, service areas, accept/decline, own earnings | Verify themselves, publish themselves, see other providers' earnings |
| Admin | JWT with `role='admin'` | Moderation, verification, disputes, settings, ledger | — (all actions audit-logged) |
| Edge Function | service role | Privileged writes (payments, refunds, verification provisioning) | Not exposed to clients; secrets server-side only |

## 2. What protects what

| Risk | Control | Where |
| --- | --- | --- |
| Double booking | PostgreSQL `EXCLUDE USING gist` constraint + in-transaction availability re-check | `bookings_no_double_booking`, `create_booking` |
| Client-supplied prices/fees | All money recomputed server-side from DB rows and Routes API | `create_booking`, `booking-quote` |
| Privilege escalation | Guard triggers reject `role`, `email_verified`, `verification`, `published`, `avg_rating` changes from non-service roles | `profiles`, `provider_profiles` triggers |
| Fake payment confirmation | Only the signature-verified webhook can capture a payment; idempotent by event id | `payment-webhook` |
| Cross-user data access | RLS on every table; no policies at all on financial tables for client roles | `20261011000012_rls.sql` |
| Exact address leakage | Approximate provider location in discovery; exact `booking_locations` scoped to participants | `provider_discovery` view, RLS |
| Card data exposure | Tokenised gateway integration; no PAN/CVV in scope | `_shared/payments.ts` |
| Verification document leakage | Private storage bucket; folder-per-user policies; admin access via service role | storage policies |
| Message tampering | Messages are insert-only for clients; only `read_at` is updatable, enforced by trigger | `messages_guard_columns` |
| Review fraud | One review per booking, only for completed bookings by the client | unique index + insert policy |
| Blocked-user contact | Messaging insert policy checks `is_blocked_between` | messages policy |
| Silent admin abuse | Append-only `audit_logs` (no UPDATE/DELETE granted) on sensitive tables | audit triggers |

## 3. Secrets handling

- Client bundles contain **only** `EXPO_PUBLIC_*` values (URL + anon key + a
  boolean). Verify before release:
  ```bash
  cd apps/mobile && npx expo export --platform ios && ! grep -r "service_role" dist/ 
  ```
- The service-role key lives in Supabase secrets and the admin host env only.
- Google Maps server key never leaves Edge Functions.
- Payment gateway secrets live in Edge Function secrets; the mobile app only
  receives an opaque client payload from `booking-create`.
- `.env*` files are git-ignored; `.env.example` files contain placeholders only.

## 4. Data protection (Botswana Data Protection Act, 2018 — orientation only)

This section describes engineering controls; **it is not legal advice**.

| Principle | Implementation |
| --- | --- |
| Lawful basis & consent | Terms + privacy acceptance timestamps on `profiles`; age confirmation stored |
| Purpose limitation | Legal name/DOB exist solely for verification; never surfaced publicly |
| Data minimisation | No background location, no card data, no unnecessary Google payload retention; place_id + coordinates only where a booking needs them |
| Storage limitation | `docs/legal/privacy-policy.md` documents the retention schedule; `account-delete` implements deletion with a defined financial-record retention carve-out |
| Integrity & confidentiality | RLS everywhere, private buckets, TLS in transit, encrypted at rest (Supabase default) |
| Data subject rights | In-app access (profile/bookings/payments), correction (profile editor), deletion (Settings → Delete account) |
| Breach notification | Incident runbook in DEPLOYMENT.md §5; notification obligations reviewed with counsel |

**Actions required before launch (owner: business, not engineering):**

- [ ] Register as a data controller with the relevant Botswana authority if required.
- [ ] Appoint a data protection contact and publish the contact channel.
- [ ] Execute provider agreements (see `docs/legal/provider-agreement.md`) and
      confirm contractor classification with counsel.
- [ ] Confirm consumer-protection disclosures (cancellation/refund terms shown
      before payment — already implemented in the UI).
- [ ] Confirm tax registration/VAT treatment for the booking fee and commission.
- [ ] Obtain insurance/liability advice for in-person services.

## 5. Safety controls (product-level)

- Consent checklist per booking, both parties, with an explicit ongoing-consent
  acknowledgement; consent may be withdrawn at any time.
- Reporting (`reports`), blocking (`blocked_users`), disputes, support tickets,
  session check-in/check-out.
- Safety copy states plainly that Pillow Thief **does not** contact emergency
  services and is not an emergency service.
- Session-stopping and harassment reporting never penalise the reporter.

## 6. Reporting a vulnerability

Contact the platform owner directly with: affected component, reproduction
steps, and impact. Do not test against production user data, do not run
automated scanners against production, and allow reasonable time for a fix
before disclosure.
