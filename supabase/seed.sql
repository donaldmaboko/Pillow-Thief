-- ============================================================================
-- Pillow Thief :: Bootstrap seed data
-- ----------------------------------------------------------------------------
-- Creates a single administrator account. The previous demo providers,
-- clients, bookings, reviews and promo codes have been removed — add real
-- accounts by signing up in the app.
--
-- Password for the seeded account: Password123!
-- Change it after the first sign-in on any non-local environment.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin auth user (the profiles row is created by the on_auth_user_created
--    trigger defined in 20261011000003_profiles.sql)
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid := '11111111-aaaa-4000-8000-000000000001'::uuid;
  v_pw text := extensions.crypt('Password123!', extensions.gen_salt('bf'));
begin
  -- NOTE: email_change must be set to '' (empty string), never left NULL.
  -- Hosted Supabase GoTrue scans this column into a non-nullable string, so a
  -- NULL here makes *all* sign-in attempts fail with HTTP 500
  -- "Database error querying schema". (Local Supabase defaults it to '', which
  -- is why this only bites on hosted projects.)
  insert into auth.users
    (id, instance_id, email, encrypted_password, email_confirmed_at,
     confirmation_token, recovery_token, email_change, email_change_token_new,
     raw_app_meta_data,
     raw_user_meta_data, aud, role, created_at, updated_at, last_sign_in_at)
  values
    (v_admin, '00000000-0000-0000-0000-000000000000'::uuid, 'admin@pillowthief.local', v_pw, now(), '', '', '', '',
     '{"provider":"email","providers":["email"]}', '{"display_name":"Admin","role":"admin"}', 'authenticated', 'authenticated', now(), now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select id, id, id::text, 'email',
         jsonb_build_object('sub', id, 'email', email), now(), now(), now()
    from auth.users where id = v_admin
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Grant the admin role
-- ---------------------------------------------------------------------------
update public.profiles
   set role = 'admin', email_verified = true
 where id = '11111111-aaaa-4000-8000-000000000001'::uuid;
