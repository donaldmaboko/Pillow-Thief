-- ============================================================================
-- Pillow Thief :: role matrix fixtures (HOSTED-SAFE, IDEMPOTENT)
-- ----------------------------------------------------------------------------
-- Creates the two throwaway accounts used by scripts/verify_roles.mjs:
--
--   qa.client@pillowthief.test    22222222-bbbb-4000-8000-000000000001
--   qa.provider@pillowthief.test  22222222-bbbb-4000-8000-000000000002
--   password for both:            QaPassword123!
--
-- ...plus a pending provider_application for the provider account with a
-- fixed id (22222222-bbbb-4000-8000-000000000003).
--
-- This file RESETS the fixtures to a clean pre-test state, so it can be
-- re-run before every verify_roles.mjs run:
--   * profiles.role reset to 'client'
--   * provider_profiles for the QA provider deleted (so an approve provisions
--     it again with published = false)
--   * swipes / matches / conversations / notifications between the two QA
--     accounts deleted (so a re-run cannot see a stale like or match)
--   * provider_applications for both QA accounts deleted + re-inserted pending
--
-- Run from the repo root:
--   supabase db query --linked -f supabase/tests/roles_fixtures.sql
--
-- NOTE (hosted Supabase): email_change must be '' (empty string), never NULL.
-- GoTrue scans that column into a non-nullable string on hosted projects, so a
-- NULL makes every sign-in fail with HTTP 500 "Database error querying schema".
-- The auth.users insert below mirrors supabase/seed.sql exactly.
-- ============================================================================

do $$
declare
  v_client   uuid := '22222222-bbbb-4000-8000-000000000001'::uuid;
  v_provider uuid := '22222222-bbbb-4000-8000-000000000002'::uuid;
  v_app      uuid := '22222222-bbbb-4000-8000-000000000003'::uuid;
  v_pw       text := extensions.crypt('QaPassword123!', extensions.gen_salt('bf'));
begin
  -- -------------------------------------------------------------------------
  -- 1. Auth users (same pattern as supabase/seed.sql)
  -- -------------------------------------------------------------------------
  insert into auth.users
    (id, instance_id, email, encrypted_password, email_confirmed_at,
     confirmation_token, recovery_token, email_change, email_change_token_new,
     raw_app_meta_data,
     raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at)
  values
    (v_client, '00000000-0000-0000-0000-000000000000'::uuid,
     'qa.client@pillowthief.test', v_pw, now(), '', '', '', '',
     '{"provider":"email","providers":["email"]}',
     '{"display_name":"QA Client","role":"client"}',
     'authenticated', 'authenticated', now(), now(), now()),
    (v_provider, '00000000-0000-0000-0000-000000000000'::uuid,
     'qa.provider@pillowthief.test', v_pw, now(), '', '', '', '',
     '{"provider":"email","providers":["email"]}',
     '{"display_name":"QA Provider","role":"provider"}',
     'authenticated', 'authenticated', now(), now(), now())
  on conflict (id) do nothing;

  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data,
     last_sign_in_at, created_at, updated_at)
  select u.id, u.id, u.id::text, 'email',
         jsonb_build_object('sub', u.id, 'email', u.email),
         now(), now(), now()
    from auth.users u
   where u.id in (v_client, v_provider)
  on conflict do nothing;

  -- Re-running with an existing account must still leave a known password and
  -- a non-NULL email_change, or sign-in would fail on the hosted project.
  update auth.users
     set encrypted_password = v_pw,
         email_change       = '',
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id in (v_client, v_provider);

  -- -------------------------------------------------------------------------
  -- 2. Profiles (the on_auth_user_created trigger creates the row; this
  --    upsert both guarantees it exists and resets the role to client)
  -- -------------------------------------------------------------------------
  insert into public.profiles (id, role, display_name, email_verified)
  values (v_client,   'client', 'QA Client',   true),
         (v_provider, 'client', 'QA Provider', true)
  on conflict (id) do update
     set role         = excluded.role,
         display_name = excluded.display_name,
         email_verified = true,
         deactivated_at = null;

  -- -------------------------------------------------------------------------
  -- 3. Reset any state left behind by a previous run
  -- -------------------------------------------------------------------------
  delete from public.provider_profiles where provider_id = v_provider;

  -- conversations opened when the pair mutually matched on an earlier run
  delete from public.conversations
   where (client_id = v_client and provider_id = v_provider)
      or (client_id = v_provider and provider_id = v_client);

  delete from public.matches
   where (user_a = v_client and user_b = v_provider)
      or (user_a = v_provider and user_b = v_client);

  delete from public.swipes
   where actor_id in (v_client, v_provider)
     and target_id in (v_client, v_provider);

  delete from public.notifications where user_id in (v_client, v_provider);

  -- Remove any application either QA account may have left (including the one
  -- a successful self-escalation attempt would have created).
  delete from public.provider_applications where user_id in (v_client, v_provider);

  -- -------------------------------------------------------------------------
  -- 4. A fresh pending application for the provider account (18+ DOB)
  -- -------------------------------------------------------------------------
  insert into public.provider_applications
    (id, user_id, status, legal_name, date_of_birth, id_document_type,
     display_name, bio, languages, city, neighbourhood, accepts,
     base_price_60_minor, boundaries)
  values
    (v_app, v_provider, 'pending',
     'QA Provider Legal Name',
     (current_date - interval '30 years')::date,
     'omang',
     'QA Provider',
     'QA fixture provider used by the role matrix test harness. Consent-led cuddle sessions in Gaborone.',
     '{en}'::public.language_tag[],
     'Gaborone',
     'Extension 12',
     '{client_visits,public_meeting}'::public.meeting_arrangement[],
     25000,
     'Cuddling only. No sexual contact. Either party may stop at any time.');
end $$;
