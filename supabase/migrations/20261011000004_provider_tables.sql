-- Pillow Thief :: provider applications, services, availability, areas, locations

-- ---------------------------------------------------------------------------
-- Provider applications (private verification pipeline)
-- ---------------------------------------------------------------------------
create table public.provider_applications (
  id               uuid primary key default extensions.uuid_generate_v4(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  status           public.verification_state not null default 'pending',
  -- PRIVATE verification data. Never selected by non-admin roles.
  legal_name       text not null,
  date_of_birth    date not null check (date_of_birth <= (current_date - interval '18 years')),
  id_document_url  text,               -- stored in the private 'verification-documents' bucket
  id_document_type text,               -- omang / passport / drivers_license
  payout_provider  text,               -- configured payout provider id (tokenised, never raw bank data)
  payout_reference text,
  -- Public profile proposal
  display_name     text not null,
  bio              text not null,
  languages        public.language_tag[] not null default '{en}',
  city             text not null default 'Gaborone',
  neighbourhood    text,
  accepts          public.meeting_arrangement[] not null default '{client_visits}',
  base_price_60_minor bigint not null check (base_price_60_minor > 0),
  boundaries       text not null,
  -- Moderation
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

create index provider_applications_status_idx on public.provider_applications (status);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table public.provider_services (
  id          uuid primary key default extensions.uuid_generate_v4(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 60),
  description text not null check (char_length(description) between 20 and 600),
  -- Prices per duration, integer minor units (thebe). NULL = duration not offered.
  price_30_minor  bigint check (price_30_minor > 0),
  price_60_minor  bigint not null check (price_60_minor > 0),
  price_90_minor  bigint check (price_90_minor > 0),
  price_120_minor bigint check (price_120_minor > 0),
  currency    text not null default 'BWP',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index provider_services_provider_idx on public.provider_services (provider_id) where active;

-- ---------------------------------------------------------------------------
-- Availability: recurring weekly windows + dated exceptions + ad-hoc blocks
-- ---------------------------------------------------------------------------
create table public.provider_availability (
  id           uuid primary key default extensions.uuid_generate_v4(),
  provider_id  uuid not null references public.profiles (id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6), -- 0=Sunday
  start_minutes smallint not null check (start_minutes between 0 and 1439),
  end_minutes  smallint not null check (end_minutes between 1 and 1440),
  check (end_minutes > start_minutes)
);

create index provider_availability_provider_idx on public.provider_availability (provider_id, weekday);

create table public.provider_availability_exceptions (
  id          uuid primary key default extensions.uuid_generate_v4(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  blocked     boolean not null default true,
  note        text,
  unique (provider_id, day)
);

-- ---------------------------------------------------------------------------
-- Service areas (house-call travel zones) & approved meeting locations
-- ---------------------------------------------------------------------------
create table public.provider_service_areas (
  id          uuid primary key default extensions.uuid_generate_v4(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  city        text not null default 'Gaborone',
  center      extensions.geography(Point, 4326) not null,
  radius_km   numeric not null default 5 check (radius_km > 0 and radius_km <= 50),
  house_calls boolean not null default true,
  travel_base_fee_minor bigint not null default 0 check (travel_base_fee_minor >= 0),
  travel_per_km_minor   bigint not null default 0 check (travel_per_km_minor >= 0),
  max_travel_km numeric not null default 10 check (max_travel_km > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index provider_service_areas_geo_idx on public.provider_service_areas using gist (center);

create table public.provider_service_locations (
  id          uuid primary key default extensions.uuid_generate_v4(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  name        text not null,                     -- e.g. "Century Mall coffee shop"
  address     text not null,
  place_id    text,                              -- Google Places place_id
  location    extensions.geography(Point, 4326) not null,
  is_public_meeting boolean not null default true,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create trigger provider_applications_set_updated_at
before update on public.provider_applications
for each row execute function public.set_updated_at();

create trigger provider_services_set_updated_at
before update on public.provider_services
for each row execute function public.set_updated_at();
