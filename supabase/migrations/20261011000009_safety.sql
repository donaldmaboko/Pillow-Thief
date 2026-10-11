-- Pillow Thief :: trust & safety — reports, support tickets, disputes

create table public.reports (
  id           uuid primary key default extensions.uuid_generate_v4(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  booking_id   uuid references public.bookings (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  category     public.report_category not null,
  description  text not null check (char_length(description) between 10 and 2000),
  status       public.report_status not null default 'open',
  assigned_to  uuid references public.profiles (id),
  resolution_note text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at);

create table public.support_tickets (
  id          uuid primary key default extensions.uuid_generate_v4(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete set null,
  category    text not null check (category in ('booking', 'payment', 'safety', 'account', 'other')),
  subject     text not null check (char_length(subject) between 3 and 120),
  body        text not null check (char_length(body) between 10 and 4000),
  status      public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles (id),
  resolution_note text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.support_ticket_replies (
  id          uuid primary key default extensions.uuid_generate_v4(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create table public.disputes (
  id          uuid primary key default extensions.uuid_generate_v4(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  opened_by   uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 10 and 2000),
  status      public.dispute_status not null default 'open',
  assigned_to uuid references public.profiles (id),
  -- Outcome decided by admins after investigation.
  outcome     text check (outcome in ('refund_full', 'refund_partial', 'no_refund', 'credit_provider')),
  refund_minor bigint check (refund_minor >= 0),
  resolution_note text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (booking_id)
);

create index disputes_status_idx on public.disputes (status, created_at);

-- Session check-in / check-out safety feature (optional, user-driven).
create table public.session_checkins (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  -- User pressed the "I need help" button. Support is alerted; this does
  -- NOT contact emergency services automatically.
  help_requested_at timestamptz
);
