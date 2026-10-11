-- Pillow Thief :: payments, refunds, payouts, platform settings
--
-- Money is stored as integer minor units (thebe). Never floats.
-- Payment outcomes are only ever advanced by the payment webhook Edge
-- Function (service_role), never by client writes (enforced by RLS: no
-- insert/update policies exist for these tables for normal roles).

create table public.payments (
  id            uuid primary key default extensions.uuid_generate_v4(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  client_id     uuid not null references public.profiles (id),
  provider_id   uuid not null references public.profiles (id),
  gateway       public.payment_provider not null default 'sandbox',
  gateway_intent_id text,
  gateway_charge_id text,
  status        public.payment_status not null default 'created',
  amount_minor  bigint not null check (amount_minor > 0),
  currency      text not null default 'BWP',
  -- Webhook idempotency: one row per gateway event.
  last_event_id text,
  last_event_at timestamptz,
  failure_code  text,
  failure_reason text,
  captured_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (gateway, gateway_intent_id)
);

create index payments_booking_idx on public.payments (booking_id);
create index payments_status_idx on public.payments (status);

create table public.refunds (
  id            uuid primary key default extensions.uuid_generate_v4(),
  payment_id    uuid not null references public.payments (id) on delete cascade,
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  gateway_refund_id text,
  status        public.refund_status not null default 'pending',
  amount_minor  bigint not null check (amount_minor > 0),
  currency      text not null default 'BWP',
  reason        text not null,
  initiated_by  uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index refunds_payment_idx on public.refunds (payment_id);

create table public.provider_payouts (
  id            uuid primary key default extensions.uuid_generate_v4(),
  provider_id   uuid not null references public.profiles (id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  gross_minor   bigint not null default 0,
  commission_minor bigint not null default 0,
  refunds_minor bigint not null default 0,
  adjustments_minor bigint not null default 0,
  net_minor     bigint not null default 0,
  currency      text not null default 'BWP',
  status        public.payout_status not null default 'pending',
  gateway_payout_id text,
  -- Tokenised payout destination reference; raw bank details never stored.
  payout_destination_ref text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  check (period_end >= period_start)
);

create index provider_payouts_provider_idx on public.provider_payouts (provider_id, period_end desc);

-- ---------------------------------------------------------------------------
-- Platform settings (single row). Commission and fees are configurable by
-- admins only; clients/providers have read access to non-sensitive keys.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id          boolean primary key default true check (id), -- enforce single row
  commission_bps integer not null default 1500 check (commission_bps between 0 and 9000),
  booking_fee_minor bigint not null default 2000 check (booking_fee_minor >= 0),
  tax_rate_bps integer not null default 1400 check (tax_rate_bps between 0 and 9000),
  currency    text not null default 'BWP',
  maintenance_mode boolean not null default false,
  bookings_enabled boolean not null default true,
  promo_enabled boolean not null default false,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

insert into public.platform_settings (id) values (true);

-- Promo codes with expiry + usage limits (never open-ended).
create table public.promo_codes (
  code        text primary key,
  discount_minor bigint not null check (discount_minor > 0),
  currency    text not null default 'BWP',
  max_uses    integer not null default 100,
  used_count  integer not null default 0,
  per_user_limit integer not null default 1,
  expires_at  timestamptz not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.promo_redemptions (
  code        text not null references public.promo_codes (code) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete set null,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();
