-- Pillow Thief :: profiles (public user record)
--
-- PROFILES vs IDENTITY:
--   profiles           -> public-facing + account data (this table)
--   provider_profiles  -> professional profile shown in discovery
--   provider_applications.legal_name + identity documents
--                      -> private verification data, never exposed publicly
--
-- Role / verification / commission columns are protected by triggers so a
-- normal client request can NEVER escalate privileges.

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.user_role not null default 'client',
  display_name       text not null check (char_length(display_name) between 2 and 40),
  avatar_url         text,
  country            text not null default 'BW',
  preferred_language public.language_tag not null default 'en',
  email_verified     boolean not null default false,
  terms_accepted_at  timestamptz,
  privacy_accepted_at timestamptz,
  age_confirmed_at   timestamptz,
  -- Expo push token for notifications.
  expo_push_token    text,
  -- Notification preferences (non-essential categories only).
  notify_booking_updates boolean not null default true,
  notify_messages        boolean not null default true,
  notify_promotions      boolean not null default false,
  deactivated_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Public account record. Legal name, identity docs and financial details live in private tables.';

create table public.provider_profiles (
  provider_id   uuid primary key references public.profiles (id) on delete cascade,
  headline      text not null default '' check (char_length(headline) <= 120),
  bio           text not null default '' check (char_length(bio) <= 1500),
  photo_urls    text[] not null default '{}',
  languages     public.language_tag[] not null default '{en}',
  verification  public.verification_state not null default 'unverified',
  city          text not null default 'Gaborone',
  neighbourhood text,
  -- Privacy-safe approximate location. NEVER a home address.
  approx_location extensions.geography(Point, 4326),
  accepts       public.meeting_arrangement[] not null default '{client_visits}',
  -- Instant booking vs approval workflow.
  instant_booking boolean not null default false,
  -- Cancellation policy (client-facing). Platform floor enforced in code.
  full_refund_before_hours    numeric not null default 24,
  partial_refund_before_hours numeric not null default 6,
  partial_refund_percent      numeric not null default 50 check (partial_refund_percent between 0 and 100),
  -- Booking lead time & buffers.
  min_notice_minutes   integer not null default 120,
  prep_buffer_minutes  integer not null default 30,
  travel_buffer_minutes integer not null default 30,
  published        boolean not null default false,
  avg_rating       numeric(3,2),
  review_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.provider_profiles is 'Professional profile shown in discovery. Only published=true + verification=verified providers appear publicly.';
create index provider_profiles_discovery_idx
  on public.provider_profiles (city)
  where published and verification = 'verified';
create index provider_profiles_location_idx
  on public.provider_profiles using gist (approx_location);

create table public.blocked_users (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.trusted_contacts (
  id          uuid primary key default extensions.uuid_generate_v4(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  phone       text not null,
  relationship text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- 1. Prevent role / privilege escalation from ordinary client requests.
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
as $$
begin
  -- The service_role (backend) and superuser provisioning may change these.
  -- Ordinary authenticated/anon roles may not.
  if current_user not in ('service_role', 'postgres') then
    if new.role is distinct from old.role then
      raise exception 'role changes are not permitted';
    end if;
    if new.email_verified is distinct from old.email_verified then
      raise exception 'email_verified changes are not permitted';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_fields
before update on public.profiles
for each row execute function public.protect_privileged_profile_fields();

create or replace function public.protect_provider_verification_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    if new.verification is distinct from old.verification then
      raise exception 'verification changes are not permitted';
    end if;
    if new.published is distinct from old.published then
      raise exception 'publishing changes are not permitted';
    end if;
    if new.avg_rating is distinct from old.avg_rating
       or new.review_count is distinct from old.review_count then
      raise exception 'rating fields are managed by the platform';
    end if;
  end if;
  return new;
end;
$$;

create trigger provider_profiles_protect_fields
before update on public.provider_profiles
for each row execute function public.protect_provider_verification_fields();

-- 2. Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3. Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();
