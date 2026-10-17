# Architecture blueprint — Pillow Thief

Status: **approved for the Builder rewrite.** Recon map in `recon.md`,
feature matrix in `features.csv`.

---

## 1. Stack (unchanged — one database, no microservices)

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo SDK **57** + expo-router + TypeScript | pinned: owner's Expo Go client is SDK 57 |
| State | zustand (`src/stores/session.ts`) + TanStack Query | already in place |
| Web admin | Next.js App Router (server components + server actions) | already in place |
| Database | Postgres (Supabase) + PostGIS + RLS | already rich; we extend, not replace |
| Auth | Supabase Auth, role on `public.profiles` | single source of truth |
| Privileged writes | `security definer` RPCs granted by `is_admin()` | keeps admin off the service-role key |
| Money | integer minor units + `currency` | existing convention |
| Jobs | `pg_cron` (already enabled region) or Supabase scheduled functions | for expiry/cleanup |
| Media | Supabase Storage private bucket + signed URLs | paywall enforcement |

**Rule kept from `apps/admin`:** authorization is enforced twice — in the UI
*and* in the data layer. Hiding a button is never the control.

---

## 2. Updated file structure

Existing paths are untouched unless marked.

```
packages/shared/src/
  index.ts                      # + export new modules
  types.ts                      # + Swipe, Match, Subscription, AdminMetrics
  swipes.ts                     # NEW  SwipeDirection, SWIPE_DIRECTIONS, labels, INTENT_OPTIONS
  roles.ts                      # NEW  ROLE_CAPABILITIES capability map + can(role, cap)
  subscriptions.ts              # NEW  tiers, entitlements, media visibility (phase 3)
  compatibility.ts              # NEW  questionnaire scoring types (phase 6)

apps/mobile/
  app/index.tsx                 # CHANGED role-based redirect
  app/(app)/(tabs)/_layout.tsx  # CHANGED tabs composed from role capabilities
  app/(app)/(tabs)/deck.tsx     # NEW  swipe deck (client)
  app/(admin)/_layout.tsx       # NEW  admin guard + stack
  app/(admin)/index.tsx         # NEW  admin overview
  app/(admin)/verification.tsx  # NEW  provider application queue
  app/(admin)/moderation.tsx    # NEW  reports / disputes / tickets
  app/(admin)/settings.tsx      # NEW  platform settings
  app/(provider)/_layout.tsx    # NEW  provider guard (fixes deep-link hole)
  app/(app)/(tabs)/profile.tsx  # CHANGED admin + provider entries
  src/features/roles/capabilities.ts   # NEW  re-export + guards (RequireRole)
  src/features/roles/RoleGate.tsx      # NEW  <RoleGate allow={[...]}>
  src/features/swipe/useDeck.ts        # NEW  deck query + optimistic removal
  src/features/swipe/useSwipe.ts       # NEW  record_swipe mutation
  src/features/swipe/SwipeCard.tsx     # NEW  card + gesture
  src/features/swipe/SwipeDeck.tsx     # NEW  stack renderer (memoised, no re-alloc in hot path)
  src/features/matches/useMatches.ts   # NEW  matches query + realtime subscription
  src/features/admin/useAdminData.ts   # NEW  overview/queue/moderation queries
  src/features/admin/useAdminActions.ts# NEW  admin RPC mutations

supabase/migrations/
  20261017000001_roles_hardening.sql   # NEW  phase 1
  20261017000002_swipes_matching.sql   # NEW  phase 2
  2026101700000N_*.sql                 # phases 3-7
```

Everything new is a **feature module** under `src/features/*`; no existing
helper is moved or renamed.

---

## 3. Role capability matrix (the contract)

`ROLE_CAPABILITIES` in `packages/shared/src/roles.ts` is the single source of
truth, consumed by the tab bar, the guards and the role test suite.

| Capability | client | provider | admin |
|---|---|---|---|
| `discover.swipe` | ✅ | ✅ | ✅ |
| `discover.search` / `map` | ✅ | ✅ | ✅ |
| `book.create` | ✅ | — | — |
| `book.receive` | — | ✅ | — |
| `provider.studio` | — | ✅ | — |
| `provider.apply` | ✅ | — | — |
| `chat.participate` | ✅ | ✅ | ✅ |
| `safety.report` | ✅ | ✅ | ✅ |
| `admin.console` | — | — | ✅ |
| `admin.verify_provider` | — | — | ✅ |
| `admin.moderate` | — | — | ✅ |
| `admin.platform_settings` | — | — | ✅ |

**Navigation contract**

| Role | Tabs |
|---|---|
| client | Home · Cuddle(deck) · Discover · Map · Bookings · Profile |
| provider | Requests · Studio · Messages · Profile |
| admin | Console · Verification · Moderation · Settings · Profile |

`app/index.tsx` redirects: `admin → /(admin)`, `provider → /(provider)/dashboard`,
`client → /(app)/(tabs)/deck`.

---

## 4. Database changes

### 4.1 Phase 1 — role hardening

```sql
-- (a) stop self-escalation of provider_applications.status
create or replace function public.protect_application_status()
returns trigger language plpgsql as $$
begin
  if current_user not in ('service_role','postgres') and not public.is_admin() then
    if tg_op = 'INSERT' and coalesce(new.status,'pending') <> 'pending' then
      raise exception 'applications must be submitted with status = pending';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      raise exception 'application status is managed by the platform';
    end if;
  end if;
  return new;
end $$;

create trigger provider_applications_guard_status
before insert or update on public.provider_applications
for each row execute function public.protect_application_status();

-- (b) admin-gated RPCs so a mobile admin never needs the service-role key.
--     security definer owned by postgres ⇒ the protect_* triggers pass.
create or replace function public.admin_decide_application(
  p_application uuid, p_action text, p_note text default null
) returns jsonb ... ;   -- approve | reject | request_more_info
--   approve ⇒ application.status='verified'; upsert provider_profiles
--   (verification='verified', published=false); profiles.role='provider';
--   notification to the applicant. Every branch logs to audit_logs.

create or replace function public.admin_set_provider_status(
  p_provider uuid, p_action text   -- suspend | reinstate | publish | unpublish
) returns jsonb ... ;

create or replace function public.admin_metrics()
returns jsonb ...  -- users by role, providers pending/verified, bookings by
                   -- status, GMV 30d, open reports/disputes/tickets
                   -- (aggregates only; bounded queries)

-- (c) consistent admin write grants
create policy availability_write_admin       on public.provider_availability
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy availability_exceptions_admin  on public.provider_availability_exceptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy service_areas_write_admin       on public.provider_service_areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy service_locations_write_admin   on public.provider_service_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- (d) index audit: fill the gaps
create index if not exists bookings_client_idx    on public.bookings (client_id, starts_at desc);
create index if not exists messages_conv_idx      on public.messages (conversation_id, created_at desc);
create index if not exists reports_status_idx     on public.reports (status, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
```

All phase-1 functions are `security definer set search_path = public`,
`revoke execute from anon`, `grant execute to authenticated`, and start with
`if not public.is_admin() then raise exception 'not authorised' using errcode='42501'; end if;`.

### 4.2 Phase 2 — swipes & matching (the Tinder layer)

```sql
create type public.swipe_direction as enum ('like','pass','super_like');

create table public.swipes (
  actor_id   uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  direction  public.swipe_direction not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, target_id),          -- one row per pair: no unbounded growth
  check (actor_id <> target_id)
);
create index swipes_target_like_idx on public.swipes (target_id, direction)
  where direction in ('like','super_like');

create table public.matches (
  id              uuid primary key default extensions.uuid_generate_v4(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  matched_at      timestamptz not null default now(),
  unmatched_at    timestamptz,
  check (user_a < user_b),                    -- canonical order, dedupes the pair
  unique (user_a, user_b)
);

alter publication supabase_realtime add table public.matches;

-- deck: distance-sorted, excludes self / already-swiped / blocked /
-- unverified-unpublished / deactivated. Bounded by p_limit.
create or replace function public.discovery_deck(
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_km numeric default 50,
  p_intent text default null,
  p_limit integer default 20
) returns table (
  provider_id uuid, display_name text, avatar_url text, headline text,
  city text, neighbourhood text, distance_km numeric, avg_rating numeric,
  review_count integer, starting_price_minor bigint, languages public.language_tag[],
  instant_booking boolean, verification public.verification_state
) ... ;

-- double-blind: both directions must be a like. Atomic, race-safe:
--   insert ... on conflict (actor_id,target_id) do update  (re-swipe changes direction)
--   then select reverse like; if present, insert into matches ... on conflict do nothing
--   and create the conversation in the same transaction.
create or replace function public.record_swipe(
  p_target uuid, p_direction public.swipe_direction
) returns jsonb ... ;   -- {direction, matched bool, match_id, conversation_id}

create or replace function public.list_matches(p_limit integer default 50)
returns table (match_id uuid, other_id uuid, display_name text, avatar_url text,
               conversation_id uuid, matched_at timestamptz) ... ;

create or replace function public.unmatch(p_match uuid) returns void ... ;
```

Rate limiting (`X05`): `record_swipe` rejects when the caller has written more
than 200 swipes in the last hour (`swipes` PK keeps the table bounded).

### 4.3 Phases 3–7 (schema sketches, built later)

```sql
-- Phase 3 OnlyFans: tiers + gated media
create type public.media_visibility as enum ('public','subscribers','purchased');
create table public.subscription_tiers  (id uuid pk, provider_id uuid, name text,
  price_minor bigint, currency text, perks jsonb, active boolean);
create table public.subscriptions       (id uuid pk, tier_id uuid, subscriber_id uuid,
  status text check (status in ('active','past_due','cancelled','expired')),
  current_period_end timestamptz, unique (tier_id, subscriber_id));
create table public.media_assets        (id uuid pk, owner_id uuid, storage_path text,
  visibility public.media_visibility, price_minor bigint, tier_id uuid);
-- entitlement check lives in one place:
create function public.can_view_media(p_asset uuid) returns boolean ...;
create function public.issue_media_url(p_asset uuid) returns jsonb ...; -- signed URL

-- Phase 4 Bumble: conditional first-message window
alter table public.conversations add column initiator_id uuid references public.profiles(id);
alter table public.conversations add column expires_at timestamptz;
alter table public.provider_profiles add column reply_window_hours integer default 24;
-- pg_cron every 15 min: expire conversations past expires_at with no messages

-- Phase 5 Grindr: presence
alter table public.profiles add column last_seen_at timestamptz;
-- presence via Realtime presence channel; approx-location jitter applied in
-- discovery_deck so exact coordinates are never returned to a client

-- Phase 6 OkCupid: questionnaire scoring
create table public.questions          (id uuid pk, prompt text, kind text, options jsonb);
create table public.question_answers   (user_id uuid, question_id uuid, answer jsonb,
  importance smallint, primary key (user_id, question_id));
create table public.dealbreakers       (user_id uuid, question_id uuid, primary key (user_id, question_id));
create function public.compatibility(a uuid, b uuid) returns numeric ...;

-- Phase 7 HER: community
create table public.identity_tags    (id uuid pk, kind text, label text);
create table public.profile_tags     (user_id uuid, tag_id uuid, primary key (user_id, tag_id));
create table public.community_posts  (id uuid pk, author_id uuid, body text,
  visibility text, status text default 'visible');
create table public.community_events (id uuid pk, host_id uuid, title text,
  starts_at timestamptz, location geography(Point,4326), capacity integer);
create table public.event_rsvps      (event_id uuid, user_id uuid, status text,
  primary key (event_id, user_id));
```

---

## 5. Endpoint additions (RPC surface)

| method | path (RPC) | who | input | output | phase |
|---|---|---|---|---|---|
| POST | `rpc/discovery_deck` | authenticated | lat, lng, max_km, intent, limit | card rows | 2 |
| POST | `rpc/record_swipe` | authenticated | target, direction | `{matched, match_id, conversation_id}` | 2 |
| POST | `rpc/list_matches` | authenticated | limit | match rows | 2 |
| POST | `rpc/unmatch` | authenticated | match_id | void | 2 |
| POST | `rpc/admin_metrics` | admin | — | aggregate metrics | 1 |
| POST | `rpc/admin_decide_application` | admin | application, action, note | `{status, provider_id}` | 1 |
| POST | `rpc/admin_set_provider_status` | admin | provider, action | `{verification, published}` | 1 |
| — | `reports` / `disputes` / `support_tickets` UPDATE | admin | — | — | 1 | direct PostgREST under the existing `is_admin()` policies |
| POST | `rpc/issue_media_url` | entitled | asset | `{url, expires_at}` | 3 |
| POST | `rpc/compatibility` | authenticated | other_user | score | 6 |

Reads for the admin console use PostgREST `select` under the existing
`is_admin()` policies (no new routes needed): `reports`, `disputes`,
`support_tickets`, `provider_applications`, `bookings`, `payments`,
`platform_settings`.

---

## 6. The parts that bite

- **Location spoofing.** Never return exact provider coordinates. `discovery_deck`
  returns a *rounded* `distance_km` and a jittered point; exact
  `approx_location` stays behind the owner/admin policy (phase 5 hardens).
- **Paywall bypass.** Signed URLs only, issued by `issue_media_url` after an
  entitlement check; the private bucket has **no** public read policy; the
  mobile client never receives a storage path it cannot otherwise render.
- **Race conditions.** Double booking already uses a GiST exclusion constraint.
  Double matching uses `unique (user_a, user_b)` + `on conflict do nothing`, and
  `record_swipe` is a single transaction — two simultaneous likes cannot create
  two matches or two conversations.
- **Message delays.** Realtime is already published for `messages`; the chat
  screen adds a 20 s fallback poll so a dropped socket does not look like a
  lost message (phase 4).
- **Idempotency.** `record_swipe` upserts; `matches` is unique; admin actions are
  safe to retry (they set absolute state, not increments).
- **Time zones.** Availability already evaluates in `Africa/Gaborone`; every new
  timestamp is `timestamptz` UTC.
- **Rate limits.** Swipe spam is capped inside `record_swipe`.
- **Bounded queries.** Every deck/match/admin query takes an explicit `limit`;
  no unbounded `select *` in a hot path.
- **GDPR / deletion.** Deleting an auth user cascades to `profiles`; new tables
  cascade from `profiles` by design so deletion stays complete.

---

## 7. Build order

| Milestone | Contents | Screens / tables / routes |
|---|---|---|
| **M0** ✅ | Recon, feature matrix, this blueprint | `replica/*` |
| **M1 — roles** | role routing, capability map, provider guard, admin console (overview, verification, moderation, settings), status-escalation fix, admin RPCs, index audit, role test suite | `(admin)/*`, `index.tsx`, `(tabs)/_layout.tsx`, `(provider)/_layout.tsx`, migration 15, RPCs 5 |
| **M2 — swipe** | swipes + matches + deck RPC, deck screen, matches list, realtime | `(tabs)/deck.tsx`, migration 16, RPCs 4 |
| **M3 — paywall** | tiers, subscriptions, media, signed URLs | migration 17, RPCs 2 |
| **M4 — messaging policy** | first-message window, expiry cron, countdown | migration 18 |
| **M5 — presence/geo** | last_seen_at, jitter, nearby grid refresh | migration 19 |
| **M6 — questionnaire** | questions, answers, scoring, dealbreakers | migration 20, RPC 1 |
| **M7 — community** | posts, events, tags, feed moderation | migration 21 |

**Vertical slice first (M1 + M2):** a client signs in → swipes the deck → a
mutual like creates a match and a conversation → an admin signs into the same
app → sees the console, approves a provider, resolves a report. That proves the
whole stack.

Vertical-slice Definition of Done: deck/empty/error/loading states, 390 px and
tablet widths, no console errors, RLS verified per role, role matrix test green.
