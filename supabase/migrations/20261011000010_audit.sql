-- Pillow Thief :: audit logging & administrative helpers

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  actor_role public.user_role,
  action     text not null,
  table_name text,
  record_id  uuid,
  before_data jsonb,
  after_data  jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Append-only: no updates or deletes allowed for anyone except superuser.
revoke update, delete on public.audit_logs from anon, authenticated, service_role;

-- Generic audit trigger. Attached to sensitive tables below.
create or replace function public.audit_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid;
  v_role public.user_role;
begin
  v_actor := auth.uid();
  select role into v_role from public.profiles where id = v_actor;
  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, before_data, after_data)
  values (
    v_actor,
    v_role,
    tg_op,
    tg_table_name,
    coalesce(
      case when tg_op = 'INSERT' then new.id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.id end
    ),
    case when tg_op = 'DELETE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_provider_applications
after insert or update on public.provider_applications
for each row execute function public.audit_change();

create trigger audit_bookings
after insert or update on public.bookings
for each row execute function public.audit_change();

create trigger audit_payments
after insert or update on public.payments
for each row execute function public.audit_change();

create trigger audit_refunds
after insert on public.refunds
for each row execute function public.audit_change();

create trigger audit_payouts
after insert or update on public.provider_payouts
for each row execute function public.audit_change();

create trigger audit_platform_settings
after update on public.platform_settings
for each row execute function public.audit_change();

create trigger audit_disputes
after insert or update on public.disputes
for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- Role helpers used by RLS policies and Edge Functions.
-- security definer (owned by postgres => bypasses RLS) + stable.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = user_id and role = 'admin');
$$;

create or replace function public.user_role_of(user_id uuid)
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = user_id;
$$;

-- Booking participation helper (client OR provider of the booking).
create or replace function public.is_booking_party(booking_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.bookings
    where id = booking_id and (client_id = auth.uid() or provider_id = auth.uid())
  );
$$;

-- Conversation participation helper.
create or replace function public.is_conversation_party(conversation_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations
    where id = conversation_id and (client_id = auth.uid() or provider_id = auth.uid())
  );
$$;

-- Whether the caller has blocked (or been blocked by) another user.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
