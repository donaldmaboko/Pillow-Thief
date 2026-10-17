-- ============================================================================
-- Pillow Thief :: Phase 1b — profile backfill & signup-trigger hardening
-- ----------------------------------------------------------------------------
-- Two real defects:
--
--   1. `donaldmaboko@gmail.com` exists in auth.users with NO row in
--      public.profiles. The account predates the `on_auth_user_created` trigger,
--      so role is NULL, display_name is NULL, and every query that joins a
--      profile silently drops the person. Backfilled here.
--
--   2. `handle_new_user()` took the local part of the email straight into
--      `display_name`, which is `check (char_length between 2 and 40)`. An
--      address like `a@example.com` produces a 1-character name and the check
--      violation aborts the whole signup transaction. Clamped now.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1)
  );
  v_name := trim(v_name);

  -- Keep the value inside display_name's check constraint so a signup can never
  -- fail on a short or very long name.
  if char_length(v_name) < 2 then
    v_name := left(coalesce(nullif(v_name, ''), 'member') || ' member', 40);
  elsif char_length(v_name) > 40 then
    v_name := left(v_name, 40);
  end if;

  insert into public.profiles (id, display_name, email_verified)
  values (new.id, v_name, new.email_confirmed_at is not null)
  on conflict (id) do nothing;

  return new;
end $$;

-- Backfill every auth user that is missing a profile row.
with missing as (
  select u.id,
         coalesce(
           nullif(u.raw_user_meta_data ->> 'display_name', ''),
           split_part(u.email, '@', 1)
         ) as raw_name,
         u.email_confirmed_at is not null as verified
    from auth.users u
    left join public.profiles p on p.id = u.id
   where p.id is null
)
insert into public.profiles (id, display_name, email_verified)
select m.id,
       case
         when char_length(trim(m.raw_name)) between 2 and 40 then trim(m.raw_name)
         when char_length(trim(m.raw_name)) < 2
           then left(coalesce(nullif(trim(m.raw_name), ''), 'member') || ' member', 40)
         else left(trim(m.raw_name), 40)
       end,
       m.verified
  from missing m
 where m.id is not null
    on conflict (id) do nothing;
