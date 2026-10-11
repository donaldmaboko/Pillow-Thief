-- Pillow Thief :: bookings, booking locations, consent
--
-- All money columns are integer minor units (thebe for BWP).
-- All timestamps are stored UTC; clients render in Africa/Gaborone.

create table public.bookings (
  id                 uuid primary key default extensions.uuid_generate_v4(),
  client_id          uuid not null references public.profiles (id),
  provider_id        uuid not null references public.profiles (id),
  service_id         uuid not null references public.provider_services (id),
  status             public.booking_status not null default 'pending_payment',
  duration_min       integer not null check (duration_min in (30, 60, 90, 120)),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  meeting_arrangement public.meeting_arrangement not null,
  -- Server-computed price breakdown. Clients can never write these.
  session_price_minor bigint not null check (session_price_minor >= 0),
  travel_fee_minor    bigint not null default 0 check (travel_fee_minor >= 0),
  booking_fee_minor   bigint not null default 0 check (booking_fee_minor >= 0),
  tax_minor           bigint not null default 0 check (tax_minor >= 0),
  discount_minor      bigint not null default 0 check (discount_minor >= 0),
  total_minor         bigint not null check (total_minor >= 0),
  commission_minor    bigint not null default 0 check (commission_minor >= 0),
  currency            text not null default 'BWP',
  -- Snapshot of the provider cancellation policy at booking time.
  full_refund_before_hours    numeric not null default 24,
  partial_refund_before_hours numeric not null default 6,
  partial_refund_percent      numeric not null default 50,
  client_notes       text,
  decline_reason     text,
  cancelled_by       uuid references public.profiles (id),
  cancellation_reason text,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_at > starts_at),
  check (client_id <> provider_id),
  -- A booking needs a meeting arrangement compatible with the provider,
  -- enforced by RPC, not constraint, since it spans tables.
  -- Prevent a booking in the past at creation time.
  check (starts_at > created_at)
);

-- CRITICAL: prevent double booking of a provider's time via an exclusion
-- constraint over the booking time range, for any status that occupies the
-- calendar. This is enforced by PostgreSQL itself, not application code.
alter table public.bookings
  add constraint bookings_no_double_booking
  exclude using gist (
    provider_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending_payment', 'pending_approval', 'confirmed', 'in_progress'));

create index bookings_client_idx    on public.bookings (client_id, starts_at desc);
create index bookings_provider_idx  on public.bookings (provider_id, starts_at desc);
create index bookings_status_idx    on public.bookings (status);
create index bookings_time_idx      on public.bookings using gist (tstzrange(starts_at, ends_at));

-- Exact meeting point for a booking. Private: only booking participants and
-- admins can read, enforced by RLS.
create table public.booking_locations (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  arrangement public.meeting_arrangement not null,
  -- Provider-travels: client's chosen address (approximate label + point).
  client_label text,
  client_place_id text,
  client_location extensions.geography(Point, 4326),
  -- Client-visits / public meeting: approved provider location.
  service_location_id uuid references public.provider_service_locations (id),
  -- Server-computed travel estimate (from Routes API, never client-supplied).
  travel_distance_km numeric,
  travel_duration_min integer,
  created_at timestamptz not null default now()
);

-- Consent checklists acknowledged by each party for a booking.
create table public.booking_consent (
  id          uuid primary key default extensions.uuid_generate_v4(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  completed_by uuid not null references public.profiles (id),
  party       text not null check (party in ('client', 'provider')),
  contact     jsonb not null default '{}',
  conversation_preference public.consent_conversation_pref not null default 'no_preference',
  clothing_expectation text not null default '',
  personal_space_notes text not null default '',
  other_restrictions   text not null default '',
  acknowledge_ongoing_consent boolean not null default false,
  completed_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (booking_id, completed_by)
);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();
