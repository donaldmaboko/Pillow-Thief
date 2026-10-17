-- ============================================================================
-- Pillow Thief :: SAMPLE PROVIDER (test fixture — not production data)
-- ----------------------------------------------------------------------------
-- Creates ONE verified, published provider in Gaborone so the swipe deck, the
-- provider profile page and the admin console have something real to show.
--
--   email    test.provider@pillowthief.local
--   password Provider123!
--   profile  33333333-cccc-4000-8000-000000000001
--
-- Idempotent: deleting and re-inserting the dependent rows means it can be
-- re-run at any time without unique violations.
--
-- Remove everything again with:
--   supabase db query --linked -f supabase/tests/sample_provider_cleanup.sql
--
-- NOTE: email_change must be '' (empty string), never NULL, or hosted GoTrue
-- rejects every sign-in with HTTP 500 "Database error querying schema".
-- ============================================================================

do $$
declare
  v_provider uuid := '33333333-cccc-4000-8000-000000000001'::uuid;
  v_admin    uuid := '11111111-aaaa-4000-8000-000000000001'::uuid;
  -- Gaborone CBD
  v_lat double precision := -24.6541;
  v_lng double precision := 25.9087;
begin
  -- -------------------------------------------------------------------------
  -- 1. Auth user (+ identity). The on_auth_user_created trigger creates the
  --    profiles row from raw_user_meta_data.display_name.
  -- -------------------------------------------------------------------------
  insert into auth.users
    (id, instance_id, email, encrypted_password, email_confirmed_at,
     confirmation_token, recovery_token, email_change, email_change_token_new,
     raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at)
  values
    (v_provider, '00000000-0000-0000-0000-000000000000'::uuid,
     'test.provider@pillowthief.local',
     extensions.crypt('Provider123!', extensions.gen_salt('bf')),
     now(), '', '', '', '',
     '{"provider":"email","providers":["email"]}',
     '{"display_name":"Naledi M."}', 'authenticated', 'authenticated', now(), now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select id, id, id::text, 'email',
         jsonb_build_object('sub', id, 'email', email), now(), now(), now()
    from auth.users where id = v_provider
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- 2. Profile — provider role, terms accepted. Runs as the migration role, so
  --    the privileged-field trigger permits the role change.
  -- -------------------------------------------------------------------------
  update public.profiles
     set role = 'provider',
         display_name = 'Naledi M.',
         email_verified = true,
         terms_accepted_at = now(),
         privacy_accepted_at = now(),
         age_confirmed_at = now()
   where id = v_provider;

  -- -------------------------------------------------------------------------
  -- 3. Application — approved.
  -- -------------------------------------------------------------------------
  insert into public.provider_applications
    (user_id, status, legal_name, date_of_birth, display_name, bio, languages,
     city, neighbourhood, accepts, base_price_60_minor, boundaries, reviewed_by, reviewed_at)
  values
    (v_provider, 'verified', 'Naledi Mokoena', date '1996-04-11', 'Naledi M.',
     'Calm, unhurried company for people who just want to be held. I work with clients who prefer quiet sessions, soft music and no pressure to talk. New to the platform and taking a small number of bookings.',
     '{en,tn}', 'Gaborone', 'Extension 12', '{client_visits,public_meeting}', 45000,
     'No sexual contact of any kind. No nudity. Nothing that is not agreed before we start.',
     v_admin, now())
  on conflict (user_id) do nothing;

  -- -------------------------------------------------------------------------
  -- 4. Provider profile — verified and published so it reaches discovery.
  -- -------------------------------------------------------------------------
  delete from public.provider_profiles where provider_id = v_provider;
  insert into public.provider_profiles
    (provider_id, headline, bio, photo_urls, languages, verification, city,
     neighbourhood, approx_location, accepts, instant_booking, published)
  values
    (v_provider,
     'Quiet, unhurried cuddles in Gaborone',
     'Calm, unhurried company for people who just want to be held. I work with clients who prefer quiet sessions, soft music and no pressure to talk. New to the platform and taking a small number of bookings.',
     '{}', '{en,tn}', 'verified', 'Gaborone', 'Extension 12',
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     '{client_visits,public_meeting}', true, true);

  -- -------------------------------------------------------------------------
  -- 5. Services, areas, locations and availability.
  -- -------------------------------------------------------------------------
  delete from public.provider_services where provider_id = v_provider;
  insert into public.provider_services
    (provider_id, title, description, price_30_minor, price_60_minor, price_90_minor, price_120_minor, currency, active)
  values
    (v_provider, 'Cuddle session',
     'A relaxed, consent-led cuddle session. We talk through boundaries together before we start.',
     25000, 45000, 62000, 78000, 'BWP', true),
    (v_provider, 'Evening wind-down',
     'A slower session for the end of the day: dim lights, quiet music, no small talk required.',
     28000, 50000, 69000, null, 'BWP', true);

  delete from public.provider_service_areas where provider_id = v_provider;
  insert into public.provider_service_areas
    (provider_id, name, city, center, radius_km, house_calls, travel_base_fee_minor, travel_per_km_minor, max_travel_km, active)
  values
    (v_provider, 'Gaborone', 'Gaborone',
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     15, true, 3000, 500, 20, true);

  delete from public.provider_service_locations where provider_id = v_provider;
  insert into public.provider_service_locations
    (provider_id, name, address, location, is_public_meeting, active)
  values
    (v_provider, 'Riverwalk coffee shop', 'Riverwalk, Gaborone',
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     true, true);

  delete from public.provider_availability where provider_id = v_provider;
  insert into public.provider_availability (provider_id, weekday, start_minutes, end_minutes)
  select v_provider, w, 540, 1080
    from unnest(array[1, 2, 3, 4, 5, 6]) as w;
end $$;

-- Report what was created.
select p.display_name, p.role, pp.verification, pp.published,
       (select count(*) from public.provider_services s where s.provider_id = p.id) as services,
       (select count(*) from public.provider_service_areas a where a.provider_id = p.id) as areas
  from public.profiles p
  join public.provider_profiles pp on pp.provider_id = p.id
 where p.id = '33333333-cccc-4000-8000-000000000001'::uuid;
