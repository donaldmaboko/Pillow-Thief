-- ============================================================================
-- Pillow Thief :: role matrix cleanup
-- ----------------------------------------------------------------------------
-- Removes the two throwaway accounts created by supabase/tests/roles_fixtures.sql
-- and everything that hangs off them.
--
-- Deleting auth.users cascades to public.profiles (profiles.id references
-- auth.users on delete cascade), which in turn cascades to provider_profiles,
-- provider_applications, swipes, matches, conversations, notifications, etc.
-- auth.identities is removed explicitly first so the cleanup does not depend on
-- the FK's cascade behaviour.
--
-- NEVER touches admin@pillowthief.local or donaldmaboko@gmail.com: the deletes
-- are restricted to the two fixed qa.* uuids.
--
-- Run from the repo root:
--   supabase db query --linked -f supabase/tests/roles_cleanup.sql
-- ============================================================================

do $$
declare
  v_client   uuid := '22222222-bbbb-4000-8000-000000000001'::uuid;
  v_provider uuid := '22222222-bbbb-4000-8000-000000000002'::uuid;
  v_left     integer;
begin
  -- Belt and braces: drop the dependent rows even if a future schema change
  -- removes a cascade.
  delete from public.notifications          where user_id in (v_client, v_provider);
  delete from public.swipes                 where actor_id in (v_client, v_provider)
                                                or target_id in (v_client, v_provider);
  delete from public.matches                where user_a in (v_client, v_provider)
                                                or user_b in (v_client, v_provider);
  delete from public.conversations          where client_id in (v_client, v_provider)
                                                or provider_id in (v_client, v_provider);
  delete from public.provider_applications  where user_id in (v_client, v_provider);
  delete from public.provider_profiles      where provider_id in (v_client, v_provider);

  delete from auth.identities where user_id in (v_client, v_provider);
  delete from auth.users      where id      in (v_client, v_provider);

  select count(*) into v_left
    from auth.users
   where id in (v_client, v_provider)
      or email in ('qa.client@pillowthief.test', 'qa.provider@pillowthief.test');

  if v_left <> 0 then
    raise exception 'role cleanup failed: % qa auth user(s) still present', v_left;
  end if;

  raise notice 'role cleanup: qa.client and qa.provider removed';
end $$;

-- Proof for the operator's console: should return 0.
select count(*) as qa_users_remaining
  from auth.users
 where email like 'qa.%@pillowthief.test';
