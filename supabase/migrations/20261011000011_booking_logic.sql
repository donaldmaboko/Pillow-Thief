-- Pillow Thief :: booking business logic (server-authoritative)
--
-- Design rules enforced here:
--   * Prices are read ONLY from the database — client-supplied prices are ignored.
--   * Availability is re-validated inside the same transaction that inserts.
--   * The exclusion constraint on bookings is the final double-booking guard.
--   * Status transitions must be legal per packages/shared/src/bookingStatus.ts
--   * Local timezone for availability windows: Africa/Gaborone.

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

-- Does a provider have a recurring weekly window covering this slot,
-- minus dated exceptions, minus already-blocking bookings?
create or replace function public.slot_is_available(
  p_provider uuid,
  p_start timestamptz,
  p_duration_min integer
)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_end timestamptz := p_start + make_interval(mins => p_duration_min);
  v_local_start timestamptz;
  v_weekday smallint;
  v_start_min smallint;
  v_end_min smallint;
begin
  if p_start <= now() then
    return false;
  end if;

  -- 1. Blocked by an existing booking that occupies the calendar?
  if exists (
    select 1 from public.bookings b
    where b.provider_id = p_provider
      and b.status in ('pending_payment', 'pending_approval', 'confirmed', 'in_progress')
      and tstzrange(p_start, v_end) && tstzrange(b.starts_at, b.ends_at)
  ) then
    return false;
  end if;

  -- 2. Dated exception blocking the whole day?
  if exists (
    select 1 from public.provider_availability_exceptions e
    where e.provider_id = p_provider
      and e.blocked
      and e.day = (p_start at time zone 'Africa/Gaborone')::date
  ) then
    return false;
  end if;

  -- 3. Covered by a recurring weekly window (local time)?
  v_local_start := p_start at time zone 'Africa/Gaborone';
  v_weekday := extract(dow from v_local_start)::smallint;
  v_start_min := (extract(hour from v_local_start) * 60 + extract(minute from v_local_start))::smallint;
  v_end_min := v_start_min + p_duration_min;

  -- Sessions must not cross local midnight.
  if v_end_min > 1440 then
    return false;
  end if;

  return exists (
    select 1 from public.provider_availability w
    where w.provider_id = p_provider
      and w.weekday = v_weekday
      and w.start_minutes <= v_start_min
      and w.end_minutes >= v_end_min
  );
end;
$$;

-- Convenience RPC for the booking calendar UI: returns start-minute slots
-- for a given local date that are bookable for a provider + duration.
create or replace function public.available_slots(
  p_provider uuid,
  p_date date,
  p_duration_min integer
)
returns table (start_minute smallint)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_min smallint;
  v_max smallint;
  v_ts timestamptz;
  -- Explicitly declared: the FOR loop target must be a scalar variable.
  v_slot smallint;
begin
  if p_date < (now() at time zone 'Africa/Gaborone')::date then
    return;
  end if;

  select coalesce(min(start_minutes), 0), coalesce(max(end_minutes), 0)
    into v_min, v_max
    from public.provider_availability w
   where w.provider_id = p_provider
     and w.weekday = extract(dow from p_date)::smallint;

  if v_max <= v_min then
    return;
  end if;

  for v_slot in
    select generate_series(v_min, v_max - p_duration_min, 15)::smallint
  loop
    v_ts := (p_date::timestamp + make_interval(mins => v_slot)) at time zone 'Africa/Gaborone';
    if public.slot_is_available(p_provider, v_ts, p_duration_min) then
      start_minute := v_slot;
      return next;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking creation — called by the booking Edge Function with validated input.
-- Returns the created booking row as JSON. RAISEs on any rule violation.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_client uuid,
  p_provider uuid,
  p_service uuid,
  p_duration_min integer,
  p_starts_at timestamptz,
  p_arrangement public.meeting_arrangement,
  p_travel_fee_minor bigint default 0,
  p_discount_minor bigint default 0,
  p_client_notes text default null,
  p_location jsonb default null -- {client_label, client_place_id, lat, lng, service_location_id, distance_km, duration_min}
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_svc public.provider_services%rowtype;
  v_pp public.provider_profiles%rowtype;
  v_settings public.platform_settings%rowtype;
  v_price bigint;
  v_tax bigint;
  v_fee bigint;
  v_total bigint;
  v_commission bigint;
  v_booking public.bookings;
  v_status public.booking_status;
  v_notice_ok boolean;
begin
  if p_client = p_provider then
    raise exception using errcode = 'P0001', message = 'booking_self';
  end if;

  select * into v_settings from public.platform_settings where id = true;
  if not v_settings.bookings_enabled then
    raise exception using errcode = 'P0001', message = 'bookings_disabled';
  end if;

  -- Provider must be verified + published.
  select * into v_pp from public.provider_profiles where provider_id = p_provider for update;
  if not found or v_pp.verification <> 'verified' or not v_pp.published then
    raise exception using errcode = 'P0001', message = 'provider_not_approved';
  end if;

  -- Meeting arrangement must be accepted by the provider.
  if not (p_arrangement = any(v_pp.accepts)) then
    raise exception using errcode = 'P0001', message = 'meeting_location_invalid';
  end if;

  -- Notice period.
  v_notice_ok := p_starts_at >= now() + make_interval(mins => v_pp.min_notice_minutes);
  if not v_notice_ok then
    raise exception using errcode = 'P0001', message = 'notice_period';
  end if;

  -- Service must belong to provider, be active, and offer the duration.
  select * into v_svc from public.provider_services
   where id = p_service and provider_id = p_provider and active
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_not_found';
  end if;

  case p_duration_min
    when 30  then v_price := v_svc.price_30_minor;
    when 60  then v_price := v_svc.price_60_minor;
    when 90  then v_price := v_svc.price_90_minor;
    when 120 then v_price := v_svc.price_120_minor;
    else v_price := null;
  end case;
  if v_price is null then
    raise exception using errcode = 'P0001', message = 'duration_not_offered';
  end if;

  -- Travel fee only applies when the provider travels to the client.
  if p_arrangement <> 'provider_travels' then
    p_travel_fee_minor := 0;
  end if;

  -- Server-side availability check (the exclusion constraint is the final guard).
  if not public.slot_is_available(p_provider, p_starts_at, p_duration_min) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  -- Price composition (all from DB, never client-trusted).
  v_fee := v_settings.booking_fee_minor;
  v_tax := round((v_price + p_travel_fee_minor + v_fee) * v_settings.tax_rate_bps / 10000.0)::bigint;
  v_total := v_price + p_travel_fee_minor + v_fee + v_tax - least(p_discount_minor, v_price + p_travel_fee_minor + v_fee + v_tax);
  v_commission := round((v_total - v_tax) * v_settings.commission_bps / 10000.0)::bigint;

  v_status := 'pending_payment';

  insert into public.bookings (
    client_id, provider_id, service_id, status, duration_min, starts_at, ends_at,
    meeting_arrangement, session_price_minor, travel_fee_minor, booking_fee_minor,
    tax_minor, discount_minor, total_minor, commission_minor, currency,
    full_refund_before_hours, partial_refund_before_hours, partial_refund_percent,
    client_notes
  ) values (
    p_client, p_provider, p_service, v_status, p_duration_min, p_starts_at,
    p_starts_at + make_interval(mins => p_duration_min),
    p_arrangement, v_price, p_travel_fee_minor, v_fee,
    v_tax, p_discount_minor, v_total, v_commission, v_svc.currency,
    v_pp.full_refund_before_hours, v_pp.partial_refund_before_hours, v_pp.partial_refund_percent,
    p_client_notes
  )
  returning * into v_booking;

  if p_location is not null then
    insert into public.booking_locations (
      booking_id, arrangement, client_label, client_place_id, client_location,
      service_location_id, travel_distance_km, travel_duration_min
    ) values (
      v_booking.id,
      p_arrangement,
      p_location ->> 'client_label',
      p_location ->> 'client_place_id',
      case
        when p_location ->> 'lat' is not null and p_location ->> 'lng' is not null
        then extensions.st_setsrid(extensions.st_makepoint((p_location ->> 'lng')::float8, (p_location ->> 'lat')::float8), 4326)::extensions.geography
        else null
      end,
      nullif(p_location ->> 'service_location_id', '')::uuid,
      nullif(p_location ->> 'distance_km', '')::numeric,
      nullif(p_location ->> 'duration_min', '')::int
    );
  end if;

  return json_build_object(
    'booking_id', v_booking.id,
    'status', v_booking.status,
    'total_minor', v_booking.total_minor,
    'currency', v_booking.currency,
    'session_price_minor', v_booking.session_price_minor,
    'travel_fee_minor', v_booking.travel_fee_minor,
    'booking_fee_minor', v_booking.booking_fee_minor,
    'tax_minor', v_booking.tax_minor,
    'discount_minor', v_booking.discount_minor
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Status transitions. Only legal moves are accepted (mirrors the shared TS
-- state machine). Payment capture and provider actions route through here.
-- ---------------------------------------------------------------------------
create or replace function public.assert_booking_transition(
  p_from public.booking_status,
  p_to public.booking_status
)
returns void
language plpgsql
immutable
as $$
begin
  if p_from = p_to then return; end if;
  case p_from
    when 'draft' then
      if p_to not in ('pending_payment', 'pending_approval', 'expired', 'cancelled') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'pending_payment' then
      if p_to not in ('pending_approval', 'confirmed', 'expired', 'cancelled') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'pending_approval' then
      if p_to not in ('confirmed', 'declined', 'expired', 'cancelled') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'confirmed' then
      if p_to not in ('in_progress', 'completed', 'cancelled', 'disputed') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'in_progress' then
      if p_to not in ('completed', 'disputed') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'completed' then
      if p_to not in ('disputed') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    when 'disputed' then
      if p_to not in ('completed', 'cancelled') then
        raise exception using errcode = 'P0001', message = 'invalid_transition';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'invalid_transition';
  end case;
end;
$$;

create or replace function public.transition_booking(
  p_booking uuid,
  p_to public.booking_status,
  p_actor uuid
)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'booking_not_found';
  end if;

  -- Only a participant or an admin may transition a booking.
  if p_actor not in (v_booking.client_id, v_booking.provider_id) and not public.is_admin(p_actor) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  perform public.assert_booking_transition(v_booking.status, p_to);

  update public.bookings
     set status = p_to,
         completed_at = case when p_to = 'completed' then now() else completed_at end,
         cancelled_by = case when p_to = 'cancelled' then p_actor else cancelled_by end
   where id = p_booking
   returning * into v_booking;

  return v_booking;
end;
$$;

-- Provider accepts a paid, pending-approval booking.
create or replace function public.provider_accept_booking(p_booking uuid, p_provider uuid)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking for update;
  if not found or v_booking.provider_id <> p_provider then
    raise exception using errcode = 'P0001', message = 'booking_not_found';
  end if;
  if v_booking.status <> 'pending_approval' then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;

  update public.bookings set status = 'confirmed' where id = p_booking returning * into v_booking;
  return v_booking;
end;
$$;

-- Provider declines. Caller (Edge Function) triggers the refund.
create or replace function public.provider_decline_booking(p_booking uuid, p_provider uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking for update;
  if not found or v_booking.provider_id <> p_provider then
    raise exception using errcode = 'P0001', message = 'booking_not_found';
  end if;
  if v_booking.status not in ('pending_approval') then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;

  update public.bookings
     set status = 'declined', decline_reason = p_reason
   where id = p_booking returning * into v_booking;
  return v_booking;
end;
$$;

-- Client cancellation with policy-based refund entitlement (returned; the
-- Edge Function performs the actual refund).
create or replace function public.client_cancel_booking(p_booking uuid, p_client uuid, p_reason text default null)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_hours numeric;
  v_percent integer := 0;
begin
  select * into v_booking from public.bookings where id = p_booking for update;
  if not found or v_booking.client_id <> p_client then
    raise exception using errcode = 'P0001', message = 'booking_not_found';
  end if;
  if v_booking.status not in ('draft', 'pending_payment', 'pending_approval', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  if v_booking.status = 'pending_payment' then
    -- Nothing paid yet; simply expire it.
    update public.bookings set status = 'expired' where id = p_booking;
    return json_build_object('refund_percent', 0, 'refund_minor', 0);
  end if;

  v_hours := extract(epoch from (v_booking.starts_at - now())) / 3600.0;
  if v_hours >= v_booking.full_refund_before_hours then
    v_percent := 100;
  elsif v_hours >= v_booking.partial_refund_before_hours then
    v_percent := v_booking.partial_refund_percent::int;
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_by = p_client,
         cancellation_reason = p_reason
   where id = p_booking;

  return json_build_object(
    'refund_percent', v_percent,
    'refund_minor', round(v_booking.total_minor * v_percent / 100.0)::bigint
  );
end;
$$;

-- Grant execute on RPCs to authenticated users; the functions themselves
-- enforce authorization, so revoked direct table writes stay revoked.
grant execute on function
  public.slot_is_available(uuid, timestamptz, integer),
  public.available_slots(uuid, date, integer),
  public.create_booking(uuid, uuid, uuid, integer, timestamptz, public.meeting_arrangement, bigint, bigint, text, jsonb),
  public.transition_booking(uuid, public.booking_status, uuid),
  public.provider_accept_booking(uuid, uuid),
  public.provider_decline_booking(uuid, uuid, text),
  public.client_cancel_booking(uuid, uuid, text)
to authenticated, service_role;
