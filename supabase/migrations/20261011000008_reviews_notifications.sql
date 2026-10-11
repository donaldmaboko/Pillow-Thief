-- Pillow Thief :: reviews, favourites, notifications

-- ---------------------------------------------------------------------------
-- Reviews — only for eligible completed bookings, one per booking per author.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id           uuid primary key default extensions.uuid_generate_v4(),
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  provider_id  uuid not null references public.profiles (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  professionalism smallint not null check (professionalism between 1 and 5),
  punctuality  smallint not null check (punctuality between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  respect_for_boundaries smallint not null check (respect_for_boundaries between 1 and 5),
  accuracy     smallint not null check (accuracy between 1 and 5),
  body         text check (body is null or char_length(body) <= 1500),
  provider_response text check (provider_response is null or char_length(provider_response) <= 1000),
  status       text not null default 'published' check (status in ('published', 'hidden', 'reported')),
  created_at   timestamptz not null default now(),
  -- Prevent duplicate reviews for the same booking by the same author.
  unique (booking_id, author_id)
);

create index reviews_provider_idx on public.reviews (provider_id, created_at desc) where status = 'published';

-- Keep provider aggregate rating in sync (server-side, not client-writable).
create or replace function public.refresh_provider_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.provider_profiles pp
     set avg_rating = sub.avg_rating,
         review_count = sub.review_count
    from (
      select provider_id,
             round(avg(rating)::numeric, 2) as avg_rating,
             count(*)::int as review_count
        from public.reviews
       where status = 'published'
       group by provider_id
    ) sub
   where pp.provider_id = coalesce(new.provider_id, old.provider_id)
     and pp.provider_id = sub.provider_id;
  -- If the review was deleted, recompute (possibly to zero).
  if tg_op = 'DELETE' then
    update public.provider_profiles pp
       set review_count = 0, avg_rating = null
     where pp.provider_id = old.provider_id
       and not exists (select 1 from public.reviews r
                        where r.provider_id = old.provider_id and r.status = 'published');
  end if;
  return null;
end;
$$;

create trigger on_review_change
after insert or update or delete on public.reviews
for each row execute function public.refresh_provider_rating();

-- ---------------------------------------------------------------------------
-- Favourites (saved providers)
-- ---------------------------------------------------------------------------
create table public.favourites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, provider_id),
  check (user_id <> provider_id)
);

-- Recently viewed providers (drives the home screen rail).
create table public.recently_viewed (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (user_id, provider_id)
);

-- ---------------------------------------------------------------------------
-- Notifications (in-app feed; push delivery handled by Edge Function)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default extensions.uuid_generate_v4(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter publication supabase_realtime add table public.notifications;
