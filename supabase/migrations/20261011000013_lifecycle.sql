-- Pillow Thief :: lifecycle automation — notifications on booking changes,
-- payment expiry sweeper. These run in the database so no client can bypass
-- them, and they fire regardless of which code path made the change.

create or replace function public.notify_user(
  p_user uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, p_data);
end;
$$;

create or replace function public.booking_lifecycle_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_when text;
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(
      new.provider_id, 'booking.requested',
      'New booking request',
      'A client requested a ' || new.duration_min || ' minute session.',
      jsonb_build_object('booking_id', new.id)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    v_when := to_char(new.starts_at at time zone 'Africa/Gaborone', 'Dy DD Mon HH24:MI');
    case new.status
      when 'confirmed' then
        perform public.notify_user(new.client_id, 'booking.confirmed', 'Booking confirmed',
          'Your session is confirmed for ' || v_when || '.', jsonb_build_object('booking_id', new.id));
        perform public.notify_user(new.provider_id, 'booking.confirmed', 'Booking confirmed',
          'Session confirmed for ' || v_when || '.', jsonb_build_object('booking_id', new.id));
      when 'declined' then
        perform public.notify_user(new.client_id, 'booking.declined', 'Booking declined',
          'The provider could not accept this booking. Your payment will be refunded.',
          jsonb_build_object('booking_id', new.id));
      when 'cancelled' then
        perform public.notify_user(new.client_id, 'booking.cancelled', 'Booking cancelled',
          'The booking was cancelled. Refunds follow the cancellation policy.',
          jsonb_build_object('booking_id', new.id));
        perform public.notify_user(new.provider_id, 'booking.cancelled', 'Booking cancelled',
          'A booking was cancelled.', jsonb_build_object('booking_id', new.id));
      when 'completed' then
        perform public.notify_user(new.client_id, 'booking.completed', 'Thanks for cuddling with us',
          'We hope the session was comforting. Leave a review to help others.',
          jsonb_build_object('booking_id', new.id));
      when 'disputed' then
        perform public.notify_user(new.client_id, 'booking.disputed', 'Booking under review',
          'This booking has been flagged. Our team will be in touch.',
          jsonb_build_object('booking_id', new.id));
        perform public.notify_user(new.provider_id, 'booking.disputed', 'Booking under review',
          'This booking has been flagged. Our team will be in touch.',
          jsonb_build_object('booking_id', new.id));
      else
        null;
    end case;
  end if;
  return new;
end;
$$;

create trigger bookings_lifecycle_notify
after insert or update on public.bookings
for each row execute function public.booking_lifecycle_notify();

-- ---------------------------------------------------------------------------
-- Expiry sweeper: pending_payment bookings older than 30 minutes expire,
-- freeing the provider's slot (the exclusion constraint releases with the
-- status change). Run via pg_cron on hosted projects:
--
--   select cron.schedule('expire-unpaid-bookings', '5 minutes',
--     $$select public.expire_stale_bookings()$$);
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_bookings()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.bookings
       set status = 'expired'
     where status = 'pending_payment'
       and created_at < now() - interval '30 minutes'
     returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

grant execute on function public.expire_stale_bookings() to service_role;
grant execute on function public.notify_user(uuid, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Reviews: eligibility helper used by the mobile app to gate the form.
-- ---------------------------------------------------------------------------
create or replace function public.can_review_booking(p_booking uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking
      and b.client_id = auth.uid()
      and b.status = 'completed'
      and not exists (select 1 from public.reviews r where r.booking_id = p_booking and r.author_id = auth.uid())
  );
$$;

grant execute on function public.can_review_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Promos: server-side redemption validation.
-- ---------------------------------------------------------------------------
create or replace function public.validate_promo(p_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_user_uses integer;
begin
  select * into v_code from public.promo_codes where upper(code) = upper(p_code) for update;
  if not found or not v_code.active or v_code.expires_at <= now() then
    return json_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;
  if v_code.used_count >= v_code.max_uses then
    return json_build_object('valid', false, 'reason', 'fully_redeemed');
  end if;
  select count(*) into v_user_uses from public.promo_redemptions
   where code = v_code.code and user_id = auth.uid();
  if v_user_uses >= v_code.per_user_limit then
    return json_build_object('valid', false, 'reason', 'already_used_by_you');
  end if;
  return json_build_object('valid', true, 'discount_minor', v_code.discount_minor, 'currency', v_code.currency);
end;
$$;

grant execute on function public.validate_promo(text) to authenticated;
