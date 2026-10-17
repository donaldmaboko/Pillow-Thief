# Recon map — Pillow Thief (cuddle-companion marketplace)

Recon of **our own** codebase, plus the public-facing behaviour of the six
reference platforms whose *patterns* we are adopting. No code, assets, copy or
private endpoints are taken from those platforms — only well-known product
patterns (swipe decks, expiry windows, gated media, presence, questionnaires,
community feeds).

## 1. What the product is

A consent-forward marketplace where verified "providers" sell **companion
cuddle sessions** (30/60/90/120 min) by the hour. Clients discover providers,
see transparent pricing, book a slot, pay, check in, and review. Safety is a
first-class feature (consent checklist, trusted contacts, session check-ins,
reporting, disputes).

The owner's stated intent: **"it works like Tinder but for cuddles."** Today it
is a *search marketplace* (browse → filter → book). The Tinder-shaped layer —
a swipe deck and mutual-interest matching — does not exist yet. That is the
single biggest product gap.

## 2. Current surfaces

### Mobile — `apps/mobile` (Expo SDK 57, expo-router)

| Route | Purpose |
|---|---|
| `(auth)/welcome,login,register,forgot` | onboarding |
| `(app)/(tabs)/home` | client home |
| `(app)/(tabs)/explore` | provider search/list |
| `(app)/(tabs)/map` | map of providers (`react-native-maps` + `expo-location`) |
| `(app)/(tabs)/bookings` | client bookings / provider requests |
| `(app)/(tabs)/profile` | account, provider dashboard entry |
| `(provider)/apply,dashboard,services,availability,earnings,reviews` | provider studio |
| `provider/[id]` | public provider profile |
| `booking/new/[providerId]`, `booking/[id]`, `checkout/[bookingId]` | booking funnel |
| `chat/[conversationId]`, `notifications`, `favourites`, `payments`, `safety`, `settings`, `help`, `review/[bookingId]` | supporting |

Shared code: `src/components/{ui.tsx,ProviderCard.tsx}`,
`src/lib/{supabase,api,queries,format,config}.ts`, `src/stores/session.ts`,
`src/theme/{index,tokens}.ts`.

### Admin — `apps/admin` (Next.js App Router, server components + server actions)

Real admin dashboard: `overview`, `providers` (verification queue), `bookings`,
`payments` (payouts), `moderation` (reports/disputes), `settings`.
Auth via `requireAdmin()`; privileged writes go through
`supabaseAdmin()` (service role) or the `admin-verification` /
`payouts-run` Edge Functions.

### Database — Supabase (hosted `tkutsdhjsfxkikfkmztg`, Postgres + PostGIS)

- **31 tables** in `public`, 14 enums, full RLS on all of them.
- Money as integer minor units + `currency`; times `timestamptz` in UTC.
- PostGIS `geography(Point,4326)` + GIST indexes; `provider_discovery` and
  `provider_service_areas_public` security-invoker views.
- Server-authoritative RPCs: `create_booking`, `transition_booking`,
  `provider_accept_booking`, `provider_decline_booking`,
  `client_cancel_booking`, `slot_is_available`, `available_slots`,
  `validate_promo`, `service_areas_containing`, `provider_distance_km`.
- Double-booking prevented by a GiST **exclusion constraint**, not UI.
- Realtime publication: `messages`, `notifications`.
- Storage buckets: `avatars` (public), `provider-photos` (public),
  `verification-documents` (private).

## 3. Roles today

`public.user_role = enum('client','provider','admin')`.

| Role | DB capability | App surface |
|---|---|---|
| `client` | read discovery; own bookings/consent/messages/reviews/favourites; RPCs | full client UI |
| `provider` | own provider profile/services/availability/areas; own bookings/payouts | provider studio |
| `admin` | **26 RLS policies** grant read on bookings, payments, refunds, payouts, conversations, applications, reports, tickets, disputes; update on applications, reports, tickets, disputes, platform settings, services | **web admin app only** |

## 4. The defects this recon exposes

1. **Admin has no mobile surface.** `useSession` computes `isAdmin`, nothing
   reads it. `app/index.tsx` sends an admin to `/(app)/(tabs)/home` — the
   client UI. An admin and a client are visually identical in the app.
2. **No role guard on `(provider)`.** `provider/_layout.tsx` does not exist; a
   client can navigate to `/(provider)/dashboard` by deep link.
3. **Privilege escalation in `provider_applications`.** Policies only check
   `user_id = auth.uid()`, never `status`. A user can insert or update an
   application with `status = 'verified'`. It does not flip
   `provider_profiles.verification`, but it corrupts the verification pipeline
   and any workflow that trusts it.
4. **Admin cannot act from a JWT-scoped client.** `provider_profiles.verification`
   / `published` and `profiles.role` are trigger-protected to
   `service_role`/`postgres`, so approving a provider requires the service role
   (web-only). There is no `is_admin()`-guarded RPC, so mobile admins are
   read-only.
5. **Inconsistent admin write grants.** `provider_availability*`,
   `provider_service_areas`, `provider_service_locations` write policies have
   no admin branch, unlike `provider_services`.
6. **No swipe/match primitives.** No `swipes` or `matches` table, no deck RPC.
7. **No presence / last-seen.** Nothing drives "active now" or distance refresh.
8. **No subscription/media-gating schema.** `payments` handles per-booking
   charges only.

## 5. Patterns adopted from the references (patterns only, clean-room)

| Reference | Pattern we take | Where it lands |
|---|---|---|
| Tinder | swipe deck + double-blind mutual like → match | Phase 2 |
| Grindr | low-latency presence + distance-sorted grid | Phase 2/5 |
| Bumble | conditional first-message window with expiry cron | Phase 4 |
| OnlyFans | tiered subscriptions + signed-URL gated media | Phase 3 |
| OkCupid | weighted questionnaire compatibility scoring | Phase 6 |
| HER | community feed + local events + identity tags | Phase 7 |

## 6. Constraints

- Expo **SDK 57** only (the owner's Expo Go client is 57; `exposdk:57.0.0`).
- Keep every existing helper, RPC and screen working; extend, do not rewrite.
- All privileged writes stay server-authoritative (RPC / RLS), never client-trusted.
- Consent and safety rules are non-negotiable and must survive every phase.
