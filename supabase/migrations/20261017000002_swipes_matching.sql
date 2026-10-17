-- ============================================================================
-- Pillow Thief :: Phase 2 — swipes & matching (the "Tinder for cuddles" layer)
-- ----------------------------------------------------------------------------
-- Adds the swipe deck and double-blind mutual matching. Every write is
-- server-authoritative: clients INSERT/UPDATE nothing directly, they call RPCs.
--
-- Race safety: the canonical pair key (user_a < user_b) plus a unique index
-- means two simultaneous mutual likes can never create two matches, and the
-- conversation is created in the same transaction as the match.
-- ============================================================================

create type public.swipe_direction as enum ('like', 'pass', 'super_like');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.swipes (
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  direction  public.swipe_direction not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per pair: re-swiping updates, so the table can never grow unbounded.
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);

-- Reverse lookup ("who liked me") and mutual-match checks.
create index swipes_target_idx on public.swipes (target_id, created_at desc);
create index swipes_actor_recent_idx on public.swipes (actor_id, updated_at desc);

create table public.matches (
  id              uuid primary key default extensions.uuid_generate_v4(),
  user_a          uuid not null references public.profiles (id) on delete cascade,
  user_b          uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  matched_at      timestamptz not null default now(),
  unmatched_at    timestamptz,
  check (user_a < user_b),          -- canonical order dedupes the pair
  unique (user_a, user_b)
);
create index matches_user_a_idx on public.matches (user_a, matched_at desc);
create index matches_user_b_idx on public.matches (user_b, matched_at desc);

alter table public.swipes  enable row level security;
alter table public.matches enable row level security;

-- Read-only visibility for the owner; writes happen through the RPCs only.
create policy swipes_select_own on public.swipes
  for select to authenticated
  using (actor_id = auth.uid() or public.is_admin());

create policy matches_select_party on public.matches
  for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime on matches (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- discovery_deck — distance-sorted, excludes self / already-swiped / blocked.
-- Reads the provider_discovery view (verified + published + active only).
-- ---------------------------------------------------------------------------
create or replace function public.discovery_deck(
  p_lat    double precision default null,
  p_lng    double precision default null,
  p_max_km numeric default 50,
  p_limit  integer default 20
)
returns table (
  provider_id           uuid,
  display_name          text,
  avatar_url            text,
  headline              text,
  city                  text,
  neighbourhood         text,
  distance_km           numeric,
  avg_rating            numeric,
  review_count          integer,
  starting_price_minor  bigint,
  languages             public.language_tag[],
  instant_booking       boolean,
  verification          public.verification_state
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  candidates as (
    select d.*,
           case
             when p_lat is not null and p_lng is not null
              and d.lat is not null and d.lng is not null
             then extensions.st_distance(
                    extensions.st_setsrid(extensions.st_makepoint(d.lng, d.lat), 4326)::extensions.geography,
                    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
                  ) / 1000.0
             else null
           end as dist_km
      from public.provider_discovery d, me
     where d.provider_id <> me.id
       -- never show someone the caller has already swiped
       and not exists (
         select 1 from public.swipes s
          where s.actor_id = me.id and s.target_id = d.provider_id
       )
       and not public.is_blocked_between(me.id, d.provider_id)
  )
  select c.provider_id,
         c.display_name,
         c.avatar_url,
         c.headline,
         c.city,
         c.neighbourhood,
         round(c.dist_km::numeric, 1) as distance_km,
         c.avg_rating,
         c.review_count,
         c.starting_price_minor,
         c.languages,
         c.instant_booking,
         c.verification
    from candidates c
   where c.dist_km is null or c.dist_km <= coalesce(p_max_km, 50)
   order by c.dist_km nulls last, c.avg_rating desc nulls last, c.review_count desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- ---------------------------------------------------------------------------
-- record_swipe — double-blind mutual like → match → conversation, atomically
-- ---------------------------------------------------------------------------
create or replace function public.record_swipe(
  p_target    uuid,
  p_direction public.swipe_direction
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := auth.uid();
  v_recent    integer;
  v_match     public.matches;
  v_conversation uuid;
  v_client    uuid;
  v_provider  uuid;
  v_my_role   public.user_role;
  v_target_role public.user_role;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_target = v_me then
    raise exception 'cannot swipe yourself' using errcode = '22023';
  end if;

  select role into v_target_role from public.profiles
   where id = p_target and deactivated_at is null;
  if v_target_role is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(v_me, p_target) then
    raise exception 'interaction not permitted' using errcode = '42501';
  end if;

  -- Light rate limit: 200 swipes per rolling hour.
  select count(*) into v_recent
    from public.swipes
   where actor_id = v_me and updated_at > now() - interval '1 hour';
  if v_recent >= 200 then
    raise exception 'too many swipes — take a breath' using errcode = '54000';
  end if;

  insert into public.swipes (actor_id, target_id, direction)
  values (v_me, p_target, p_direction)
  on conflict (actor_id, target_id)
  do update set direction = excluded.direction, updated_at = now();

  if p_direction = 'pass' then
    return jsonb_build_object('direction', p_direction, 'matched', false);
  end if;

  -- Double-blind: only a mutual like reveals anything.
  if not exists (
    select 1 from public.swipes s
     where s.actor_id = p_target and s.target_id = v_me
       and s.direction in ('like', 'super_like')
  ) then
    return jsonb_build_object('direction', p_direction, 'matched', false);
  end if;

  insert into public.matches (user_a, user_b)
  values (least(v_me, p_target), greatest(v_me, p_target))
  on conflict (user_a, user_b) do update set unmatched_at = null
  returning * into v_match;

  if v_match.conversation_id is null then
    select role into v_my_role from public.profiles where id = v_me;
    if v_my_role = 'provider' then
      v_provider := v_me;  v_client := p_target;
    else
      v_client := v_me;    v_provider := p_target;
    end if;

    insert into public.conversations (client_id, provider_id)
    values (v_client, v_provider)
    returning id into v_conversation;

    update public.matches
       set conversation_id = v_conversation
     where id = v_match.id;
  else
    v_conversation := v_match.conversation_id;
  end if;

  insert into public.notifications (user_id, kind, title, body, data)
  select u.id, 'match', 'New cuddle match', 'You both liked each other — say hello.',
         jsonb_build_object('match_id', v_match.id, 'conversation_id', v_conversation)
    from (values (v_me), (p_target)) as u(id);

  return jsonb_build_object(
    'direction', p_direction,
    'matched', true,
    'match_id', v_match.id,
    'conversation_id', v_conversation
  );
end $$;

-- ---------------------------------------------------------------------------
-- list_who_liked_me — people who liked the caller and are still unanswered
-- ---------------------------------------------------------------------------
create or replace function public.list_who_liked_me(p_limit integer default 50)
returns table (
  actor_id      uuid,
  display_name  text,
  avatar_url    text,
  city          text,
  liked_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.actor_id, p.display_name, p.avatar_url, pp.city, s.created_at
    from public.swipes s
    join public.profiles p on p.id = s.actor_id
    left join public.provider_profiles pp on pp.provider_id = s.actor_id
   where s.target_id = auth.uid()
     and s.direction in ('like', 'super_like')
     and p.deactivated_at is null
     and not exists (
       select 1 from public.swipes mine
        where mine.actor_id = auth.uid() and mine.target_id = s.actor_id
     )
     and not public.is_blocked_between(auth.uid(), s.actor_id)
   order by s.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- ---------------------------------------------------------------------------
-- list_matches
-- ---------------------------------------------------------------------------
create or replace function public.list_matches(p_limit integer default 50)
returns table (
  match_id        uuid,
  other_id        uuid,
  display_name    text,
  avatar_url      text,
  conversation_id uuid,
  matched_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         o.id,
         p.display_name,
         p.avatar_url,
         m.conversation_id,
         m.matched_at
    from public.matches m
    cross join lateral (
      select case when m.user_a = auth.uid() then m.user_b else m.user_a end as id
    ) o
    join public.profiles p on p.id = o.id
   where (m.user_a = auth.uid() or m.user_b = auth.uid())
     and m.unmatched_at is null
   order by m.matched_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- ---------------------------------------------------------------------------
-- unmatch
-- ---------------------------------------------------------------------------
create or replace function public.unmatch(p_match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matches
     set unmatched_at = now()
   where id = p_match
     and (user_a = auth.uid() or user_b = auth.uid());

  if not found then
    raise exception 'match % not found', p_match using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.discovery_deck(double precision, double precision, numeric, integer) from public, anon;
revoke execute on function public.record_swipe(uuid, public.swipe_direction) from public, anon;
revoke execute on function public.list_who_liked_me(integer) from public, anon;
revoke execute on function public.list_matches(integer) from public, anon;
revoke execute on function public.unmatch(uuid) from public, anon;

grant execute on function public.discovery_deck(double precision, double precision, numeric, integer) to authenticated, service_role;
grant execute on function public.record_swipe(uuid, public.swipe_direction) to authenticated, service_role;
grant execute on function public.list_who_liked_me(integer) to authenticated, service_role;
grant execute on function public.list_matches(integer) to authenticated, service_role;
grant execute on function public.unmatch(uuid) to authenticated, service_role;
