# Build log

One line per screen or module. ID, date, state, what is missing, what was
harder than expected.

| ID | Date | State | Notes |
|---|---|---|---|
| M0 | 2026-10-17 | done | Recon map, feature matrix and architecture blueprint written from a full read of 14 migrations + the mobile/admin apps. |
| R03–R11 | 2026-10-17 | done | Role architecture. `packages/shared/src/roles.ts` capability map drives the tab bar, the guards and the tests. `app/index.tsx` now routes by role. Admin was previously routed to the client home — that was the reported bug. |
| R09 | 2026-10-17 | done | Security defect found in recon: `provider_applications.status` was user-writable, so an applicant could submit `status='verified'`. Guarded by a BEFORE INSERT/UPDATE trigger. |
| R08 | 2026-10-17 | done | Admin RPCs. The triggers on `profiles.role` and `provider_profiles.verification` only allowed `service_role`/`postgres`, which is why the mobile admin was read-only. Security-definer RPCs owned by postgres pass those triggers and are gated by `is_admin()`. |
| A01–A04 | 2026-10-17 | done | Four admin screens: overview metrics, verification queue (approve/reject/request-more-info/publish/suspend), moderation (reports/disputes/tickets), platform settings. All reads go through the existing `is_admin()` RLS policies — no service-role key in the mobile app. |
| A05 | 2026-10-17 | missing | Audit-trail viewer. `audit_logs` has RLS enabled with no policy, so it is service-role only. Needs an `is_admin()`-gated RPC before the mobile console can show it. Deferred deliberately rather than exposing the table. |
| S01–S07 | 2026-10-17 | done | Swipe deck and matching. `swipes` + `matches` tables, `discovery_deck`, `record_swipe` (double-blind, creates the conversation in the same transaction), `list_matches`, `list_who_liked_me`, `unmatch`. Realtime on `matches`. |
| S05 | 2026-10-17 | done | Deck UI built on core `Animated` + `PanResponder` rather than reanimated/gesture-handler worklets — fewer moving parts in Expo Go, and no per-frame array allocation while dragging. |
| S07 | 2026-10-17 | done | Match alerts fire from the RPC result *and* a Realtime subscription, so a match appears whether or not the user was on the deck screen. |
| S08 | 2026-10-17 | missing | Rewind/undo. Deliberately deferred: undoing a swipe needs a server-side delete with a cooldown, not a client-side pop. |
| X01, X05, X06 | 2026-10-17 | done | Index audit (11 new indexes), swipe rate limit (200/hour), and blocked-user exclusion on all three new paths. |
| R13 | 2026-10-17 | done | Found by the role harness, not by the app: `donaldmaboko@gmail.com` had **no `profiles` row**, so its role was NULL and every profile join dropped it. The account predates the `on_auth_user_created` trigger. Backfilled, and `handle_new_user()` now clamps `display_name` to the 2–40 char constraint so a short local part can no longer abort a signup. |
| R07 | 2026-10-17 | done | Admin console lives at `app/admin/*` (a real path segment), **not** `app/(admin)`. Expo Router strips `(group)` from URLs, so `app/(admin)/index.tsx` would have collided with `app/index.tsx` on `/` and `app/(admin)/settings.tsx` with `app/settings.tsx` on `/settings`. |
| G02 | 2026-10-17 | missing | Location fuzzing. The deck currently returns a *rounded* km figure and no coordinates, which is already better than raw, but exact provider coordinates are still behind the owner/admin policy on `provider_profiles`. Phase 5 hardens this properly. |

## Deliberately not built yet

Phases 3 (paywall/subscriptions), 4 (conditional messaging), 5 (presence),
6 (questionnaire) and 7 (community) are specified in `architecture.md` with
schema sketches, but are **not** implemented. They each need their own
migration, RPCs and screens; shipping them half-built would be worse than
leaving them out of the feature matrix as `missing`.

## Harder than expected

- **Hosted GoTrue vs local.** A hand-seeded `auth.users` row with
  `email_change = NULL` breaks *every* sign-in on hosted Supabase with
  `500 Database error querying schema`, while working fine locally. Cost real
  debugging time; now documented in `supabase/seed.sql` and
  `supabase/tests/roles_fixtures.sql`.
- **`noUncheckedIndexedAccess`** is on in this repo's tsconfig, so `arr[0]` is
  `T | undefined`. Caught at typecheck in the deck gesture handler.
- **Route depth.** `app/admin` sits one level higher than `app/(app)/(tabs)`, so the
  first import paths were one `../` too deep. Caught by `tsc`.
