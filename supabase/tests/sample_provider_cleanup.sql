-- ============================================================================
-- Pillow Thief :: remove the sample provider fixture
-- ----------------------------------------------------------------------------
-- Deletes test.provider@pillowthief.local and everything that hangs off it
-- (profiles, provider_profiles, services, availability, areas, locations,
-- applications, swipes, matches, conversations all cascade from profiles).
-- Leaves every other account untouched.
-- ============================================================================

do $$
declare
  v_provider uuid := '33333333-cccc-4000-8000-000000000001'::uuid;
  v_remaining integer;
begin
  -- Clear rows a cascade will not reach.
  delete from public.swipes          where actor_id = v_provider or target_id = v_provider;
  delete from public.matches         where user_a   = v_provider or user_b    = v_provider;
  delete from public.provider_availability      where provider_id = v_provider;
  delete from public.provider_availability_exceptions where provider_id = v_provider;
  delete from public.provider_service_locations where provider_id = v_provider;
  delete from public.provider_service_areas     where provider_id = v_provider;
  delete from public.provider_services          where provider_id = v_provider;

  delete from auth.users where id = v_provider;

  select count(*) into v_remaining
    from auth.users where email = 'test.provider@pillowthief.local';

  if v_remaining > 0 then
    raise exception 'sample provider still present after cleanup';
  end if;

  raise notice 'sample provider removed';
end $$;

select (select count(*) from auth.users) as auth_users,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.provider_profiles) as provider_profiles;
