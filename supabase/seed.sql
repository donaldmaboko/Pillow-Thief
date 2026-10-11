-- ============================================================================
-- Pillow Thief :: DEVELOPMENT seed data
-- ----------------------------------------------------------------------------
-- THIS FILE IS FOR LOCAL DEVELOPMENT ONLY. It is applied by `supabase db
-- reset` against a local instance. Never run this against staging/production.
-- All people are fictional test profiles; the sandbox payment provider is
-- clearly simulated. Password for every seeded account: Password123!
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auth users (admin, client, two verified providers, one applicant)
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin    uuid := '11111111-aaaa-4000-8000-000000000001'::uuid;
  v_client   uuid := '11111111-aaaa-4000-8000-000000000002'::uuid;
  v_thabo    uuid := '11111111-aaaa-4000-8000-000000000003'::uuid;
  v_naledi   uuid := '11111111-aaaa-4000-8000-000000000004'::uuid;
  v_kabelo   uuid := '11111111-aaaa-4000-8000-000000000005'::uuid;
  v_pw text := extensions.crypt('Password123!', extensions.gen_salt('bf'));
begin
  insert into auth.users
    (id, instance_id, email, encrypted_password, email_confirmed_at,
     confirmation_token, recovery_token, email_change_token_new, raw_app_meta_data,
     raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at)
  values
    (v_admin,  '00000000-0000-0000-0000-000000000000'::uuid, 'admin@pillowthief.local', v_pw, now(), '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Admin","role":"admin"}', 'authenticated', 'authenticated', now(), now(), now()),
    (v_client, '00000000-0000-0000-0000-000000000000'::uuid, 'lerato@pillowthief.local', v_pw, now(), '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Lerato M."}', 'authenticated', 'authenticated', now(), now(), now()),
    (v_thabo,  '00000000-0000-0000-0000-000000000000'::uuid, 'thabo@pillowthief.local', v_pw, now(), '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Thabo K."}', 'authenticated', 'authenticated', now(), now(), now()),
    (v_naledi, '00000000-0000-0000-0000-000000000000'::uuid, 'naledi@pillowthief.local', v_pw, now(), '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Naledi S."}', 'authenticated', 'authenticated', now(), now(), now()),
    (v_kabelo, '00000000-0000-0000-0000-000000000000'::uuid, 'kabelo@pillowthief.local', v_pw, now(), '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Kabelo P."}', 'authenticated', 'authenticated', now(), now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select id, id, id::text, 'email',
         jsonb_build_object('sub', id, 'email', email), now(), now(), now()
    from auth.users where email like '%@pillowthief.local'
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Roles & profiles
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin    uuid := '11111111-aaaa-4000-8000-000000000001'::uuid;
  v_thabo    uuid := '11111111-aaaa-4000-8000-000000000003'::uuid;
  v_naledi   uuid := '11111111-aaaa-4000-8000-000000000004'::uuid;
  v_kabelo   uuid := '11111111-aaaa-4000-8000-000000000005'::uuid;
begin
  update public.profiles set role = 'admin', email_verified = true where id = v_admin;
  update public.profiles set role = 'provider', email_verified = true,
    terms_accepted_at = now(), privacy_accepted_at = now(), age_confirmed_at = now()
   where id in (v_thabo, v_naledi, v_kabelo);
  update public.profiles set email_verified = true,
    terms_accepted_at = now(), privacy_accepted_at = now(), age_confirmed_at = now()
   where id not in (v_admin, v_thabo, v_naledi, v_kabelo);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Provider profiles (verified + published => appear in discovery)
-- ---------------------------------------------------------------------------
insert into public.provider_profiles
  (provider_id, headline, bio, languages, verification, city, neighbourhood,
   approx_location, accepts, instant_booking, published)
values
  ('11111111-aaaa-4000-8000-000000000003'::uuid,
   'Warm, unhurried comfort in the heart of Gaborone',
   'Professional cuddler specialising in relaxed, respectful sessions. Comfortable silence welcome. Fully vetted, boundaries always honoured.',
   '{en,tn}', 'verified', 'Gaborone', 'CBD',
   extensions.st_setsrid(extensions.st_makepoint(25.9231, -24.6282), 4326)::extensions.geography,
   '{provider_travels,client_visits}', true, true),
  ('11111111-aaaa-4000-8000-000000000004'::uuid,
   'Calm evenings, genuine connection',
   'I offer grounding, conversation-friendly cuddle sessions after work hours. Certified in consent-first practice. Sesotho and English speaking.',
   '{en,tn,af}', 'verified', 'Gaborone', 'Phakalane',
   extensions.st_setsrid(extensions.st_makepoint(25.9830, -24.5670), 4326)::extensions.geography,
   '{client_visits,public_meeting}', false, true)
on conflict (provider_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Services (prices in thebe)
-- ---------------------------------------------------------------------------
insert into public.provider_services
  (id, provider_id, title, description, price_30_minor, price_60_minor, price_90_minor, price_120_minor)
values
  ('22222222-aaaa-4000-8000-000000000001'::uuid, '11111111-aaaa-4000-8000-000000000003'::uuid,
   'Classic Comfort Cuddle', 'A relaxed, consent-first cuddle session seated or lying down, clothing on, boundaries agreed in advance.',
   15000, 25000, 35000, 45000),
  ('22222222-aaaa-4000-8000-000000000002'::uuid, '11111111-aaaa-4000-8000-000000000003'::uuid,
   'De-stress Companion Session', 'Guided breathing, calm conversation or silence, and comforting contact to close a hard day.',
   null, 30000, 42000, null),
  ('22222222-aaaa-4000-8000-000000000003'::uuid, '11111111-aaaa-4000-8000-000000000004'::uuid,
   'Evening Wind-down', 'Gentle post-work session with optional tea and conversation. Public meeting spots available.',
   17500, 27500, null, 50000)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. Availability (weekday windows) + exceptions
-- ---------------------------------------------------------------------------
insert into public.provider_availability (provider_id, weekday, start_minutes, end_minutes)
select '11111111-aaaa-4000-8000-000000000003'::uuid, w.d, 10*60, 20*60
  from unnest(array[1,2,3,4,5,6]) as w(d)
union all
select '11111111-aaaa-4000-8000-000000000004'::uuid, w.d, 17*60, 22*60
  from unnest(array[1,2,3,4,5]) as w(d);

insert into public.provider_availability_exceptions (provider_id, day, blocked, note)
values ('11111111-aaaa-4000-8000-000000000003'::uuid, current_date + 3, true, 'DEMO: day off');

-- ---------------------------------------------------------------------------
-- 6. Service areas + approved meeting locations
-- ---------------------------------------------------------------------------
insert into public.provider_service_areas
  (provider_id, name, city, center, radius_km, house_calls, travel_base_fee_minor, travel_per_km_minor, max_travel_km)
values
  ('11111111-aaaa-4000-8000-000000000003'::uuid, 'Gaborone CBD & surrounds', 'Gaborone',
   extensions.st_setsrid(extensions.st_makepoint(25.9231, -24.6282), 4326)::extensions.geography,
   8, true, 3000, 500, 12),
  ('11111111-aaaa-4000-8000-000000000003'::uuid, 'Phakalane', 'Gaborone',
   extensions.st_setsrid(extensions.st_makepoint(25.9830, -24.5670), 4326)::extensions.geography,
   5, true, 4000, 500, 10);

insert into public.provider_service_locations (provider_id, name, address, location, is_public_meeting)
values
  ('11111111-aaaa-4000-8000-000000000004'::uuid, 'Century Mall quiet lounge', 'Century Mall, Gaborone',
   extensions.st_setsrid(extensions.st_makepoint(25.9120, -24.6540), 4326)::extensions.geography, true),
  ('11111111-aaaa-4000-8000-000000000004'::uuid, 'Phakalane studio', 'Phakalane, Gaborone',
   extensions.st_setsrid(extensions.st_makepoint(25.9830, -24.5670), 4326)::extensions.geography, false);

-- ---------------------------------------------------------------------------
-- 7. A pending provider application (for the admin verification queue demo)
-- ---------------------------------------------------------------------------
insert into public.provider_applications
  (user_id, status, legal_name, date_of_birth, display_name, bio, languages, city,
   accepts, base_price_60_minor, boundaries)
values
  ('11111111-aaaa-4000-8000-000000000005'::uuid, 'pending', 'Kabelo Phiri', '1992-05-14',
   'Kabelo P.', 'Warm and attentive professional companion focused on respectful, consent-first cuddling. Weekday evenings and weekends.',
   '{en,tn}', 'Gaborone', '{provider_travels}', 22000,
   'Clothing stays on at all times. No kissing. Hands above the waist only. Either of us may pause or end the session at any time.')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Bookings: one completed (reviewable) + one upcoming confirmed.
--    Uses the real create_booking flow is bypassed intentionally here (seed
--    runs as superuser); the shape matches what the RPC produces.
-- ---------------------------------------------------------------------------
do $$
declare
  v_client uuid := '11111111-aaaa-4000-8000-000000000002'::uuid;
  v_thabo  uuid := '11111111-aaaa-4000-8000-000000000003'::uuid;
  v_service uuid := '22222222-aaaa-4000-8000-000000000001'::uuid;
  v_completed uuid := '33333333-aaaa-4000-8000-000000000001'::uuid;
  v_upcoming  uuid := '33333333-aaaa-4000-8000-000000000002'::uuid;
  v_next_sat timestamptz;
begin
  v_next_sat := date_trunc('week', now() at time zone 'Africa/Gaborone') + interval '6 days 14 hours';
  v_next_sat := v_next_sat at time zone 'Africa/Gaborone';

  -- created_at is backdated so the historical row satisfies the
  -- `starts_at > created_at` integrity guard that applies to live bookings.
  insert into public.bookings
    (id, client_id, provider_id, service_id, status, duration_min, starts_at, ends_at,
     meeting_arrangement, session_price_minor, travel_fee_minor, booking_fee_minor,
     tax_minor, discount_minor, total_minor, commission_minor, completed_at, created_at)
  values
    (v_completed, v_client, v_thabo, v_service, 'completed', 60,
     now() - interval '7 days', now() - interval '7 days' + interval '60 minutes',
     'client_visits', 25000, 0, 2000, 3780, 0, 30780, 4050, now() - interval '7 days' + interval '60 minutes',
     now() - interval '9 days'),
    (v_upcoming, v_client, v_thabo, v_service, 'confirmed', 90,
     v_next_sat, v_next_sat + interval '90 minutes',
     'provider_travels', 35000, 5500, 2000, 5950, 0, 48450, 6450, null,
     now() - interval '1 day')
  on conflict do nothing;

  insert into public.payments (booking_id, client_id, provider_id, gateway, gateway_intent_id, status, amount_minor, captured_at)
  values
    (v_completed, v_client, v_thabo, 'sandbox', 'demo_pi_completed_1', 'captured', 30780, now() - interval '8 days'),
    (v_upcoming,  v_client, v_thabo, 'sandbox', 'demo_pi_upcoming_1', 'captured', 48450, now() - interval '1 day')
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 9. A genuine-style review on the completed booking
-- ---------------------------------------------------------------------------
insert into public.reviews
  (booking_id, provider_id, author_id, rating, professionalism, punctuality,
   communication, respect_for_boundaries, accuracy, body)
values
  ('33333333-aaaa-4000-8000-000000000001'::uuid, '11111111-aaaa-4000-8000-000000000003'::uuid,
   '11111111-aaaa-4000-8000-000000000002'::uuid, 5, 5, 5, 5, 5, 5,
   'DEMO review: Thabo was respectful, right on time, and the session was exactly as described. I felt safe and relaxed the whole time.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 10. A demo promo code
-- ---------------------------------------------------------------------------
insert into public.promo_codes (code, discount_minor, max_uses, per_user_limit, expires_at, active)
values ('FIRSTCUDDLE', 5000, 500, 1, now() + interval '90 days', true)
on conflict do nothing;
