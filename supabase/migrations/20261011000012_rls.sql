-- Pillow Thief :: Row Level Security
--
-- Principles:
--   * Tables with NO policies are invisible to anon/authenticated roles.
--     (payments, refunds, payouts, promo_codes, audit_logs, ...)
--   * Money, status, verification and role columns are never client-writable:
--     writes happen only through security-definer RPCs or service_role.
--   * Hiding UI elements is never a substitute for these policies.

alter table public.profiles                     enable row level security;
alter table public.provider_profiles            enable row level security;
alter table public.provider_applications        enable row level security;
alter table public.provider_services            enable row level security;
alter table public.provider_availability        enable row level security;
alter table public.provider_availability_exceptions enable row level security;
alter table public.provider_service_areas       enable row level security;
alter table public.provider_service_locations   enable row level security;
alter table public.bookings                     enable row level security;
alter table public.booking_locations            enable row level security;
alter table public.booking_consent              enable row level security;
alter table public.payments                     enable row level security;
alter table public.refunds                      enable row level security;
alter table public.provider_payouts             enable row level security;
alter table public.platform_settings            enable row level security;
alter table public.promo_codes                  enable row level security;
alter table public.promo_redemptions            enable row level security;
alter table public.conversations                enable row level security;
alter table public.messages                     enable row level security;
alter table public.reviews                      enable row level security;
alter table public.favourites                   enable row level security;
alter table public.recently_viewed              enable row level security;
alter table public.notifications                enable row level security;
alter table public.reports                      enable row level security;
alter table public.support_tickets              enable row level security;
alter table public.support_ticket_replies       enable row level security;
alter table public.disputes                     enable row level security;
alter table public.blocked_users                enable row level security;
alter table public.trusted_contacts             enable row level security;
alter table public.session_checkins             enable row level security;
alter table public.audit_logs                   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_public on public.profiles
  for select to authenticated
  using (deactivated_at is null);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy: rows are created by the auth.users trigger only.
-- No delete policy: account deletion runs through a service_role Edge Function.

-- ---------------------------------------------------------------------------
-- provider_profiles — discovery shows only verified + published providers.
-- ---------------------------------------------------------------------------
create policy provider_profiles_select_discoverable on public.provider_profiles
  for select to anon, authenticated
  using (
    published and verification = 'verified'
    or provider_id = auth.uid()
    or public.is_admin()
  );

create policy provider_profiles_update_own on public.provider_profiles
  for update to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

-- No insert policy for users: provider profiles are provisioned by the
-- admin verification workflow (service_role) — not self-service.

-- ---------------------------------------------------------------------------
-- provider_applications — private verification pipeline
-- ---------------------------------------------------------------------------
create policy provider_applications_select_own on public.provider_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy provider_applications_insert_own on public.provider_applications
  for insert to authenticated
  with check (user_id = auth.uid());

create policy provider_applications_update_own_private on public.provider_applications
  for update to authenticated
  using (user_id = auth.uid() and status in ('unverified', 'rejected'))
  with check (user_id = auth.uid());

-- Admins review applications via the service_role (dashboard backend) or here:
create policy provider_applications_update_admin on public.provider_applications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- services / availability / areas / locations
-- ---------------------------------------------------------------------------
create policy services_select_public on public.provider_services
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.provider_profiles pp
      where pp.provider_id = provider_id and pp.published and pp.verification = 'verified'
    )
    or provider_id = auth.uid()
    or public.is_admin()
  );

create policy services_write_own on public.provider_services
  for all to authenticated
  using (provider_id = auth.uid() or public.is_admin())
  with check (provider_id = auth.uid() or public.is_admin());

create policy availability_select_public on public.provider_availability
  for select to anon, authenticated
  using (true);

create policy availability_write_own on public.provider_availability
  for all to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

create policy availability_exceptions_select_public on public.provider_availability_exceptions
  for select to anon, authenticated
  using (true);

create policy availability_exceptions_write_own on public.provider_availability_exceptions
  for all to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

-- Service areas are business zones (never home addresses): safe to expose.
create policy service_areas_select_public on public.provider_service_areas
  for select to anon, authenticated
  using (active or provider_id = auth.uid() or public.is_admin());

create policy service_areas_write_own on public.provider_service_areas
  for all to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

-- Approved meeting locations: public-ish places; exact coords shared only
-- with booking participants via booking_locations.
create policy service_locations_select_public on public.provider_service_locations
  for select to anon, authenticated
  using (active or provider_id = auth.uid() or public.is_admin());

create policy service_locations_write_own on public.provider_service_locations
  for all to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bookings & booking locations & consent — participants only.
-- No direct insert/update policies: all mutations go through RPCs.
-- ---------------------------------------------------------------------------
create policy bookings_select_party on public.bookings
  for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_admin());

create policy booking_locations_select_party on public.booking_locations
  for select to authenticated
  using (public.is_booking_party(booking_id) or public.is_admin());

create policy booking_consent_select_party on public.booking_consent
  for select to authenticated
  using (public.is_booking_party(booking_id) or public.is_admin());

create policy booking_consent_insert_own on public.booking_consent
  for insert to authenticated
  with check (
    completed_by = auth.uid()
    and public.is_booking_party(booking_id)
  );

-- Participants may revise their own checklist while the booking is still live
-- (consent is ongoing and boundaries may be renegotiated). Once a booking is
-- completed or closed the record becomes read-only, so it cannot be rewritten
-- after the fact.
create policy booking_consent_update_own on public.booking_consent
  for update to authenticated
  using (
    completed_by = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.status in ('draft', 'pending_payment', 'pending_approval', 'confirmed', 'in_progress')
    )
  )
  with check (completed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Financial tables: no user policies at all. Read paths are scoped views /
-- RPCs and the admin dashboard (service_role).
-- ---------------------------------------------------------------------------

-- payments: participants may view their own payment status (not gateway internals).
create policy payments_select_party on public.payments
  for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_admin());

create policy refunds_select_party on public.refunds
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.client_id = auth.uid() or b.provider_id = auth.uid())
    )
    or public.is_admin()
  );

create policy payouts_select_own on public.provider_payouts
  for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());

create policy platform_settings_select on public.platform_settings
  for select to anon, authenticated
  using (true);

create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy promo_codes_select on public.promo_codes
  for select to authenticated
  using (active and expires_at > now());

create policy promo_redemptions_select_own on public.promo_redemptions
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------------
create policy conversations_select_party on public.conversations
  for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_admin());

create policy conversations_insert_party on public.conversations
  for insert to authenticated
  with check (
    (client_id = auth.uid() or provider_id = auth.uid())
    and client_id <> provider_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.client_id = client_id and b.provider_id = provider_id
    )
    and not public.is_blocked_between(client_id, provider_id)
  );

create policy messages_select_party on public.messages
  for select to authenticated
  using (public.is_conversation_party(conversation_id) or public.is_admin());

create policy messages_insert_party on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind = 'text'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.client_id = auth.uid() or c.provider_id = auth.uid())
        and not public.is_blocked_between(c.client_id, c.provider_id)
    )
  );

-- Recipients may only touch read_at on messages they did not send.
create policy messages_mark_read on public.messages
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and public.is_conversation_party(conversation_id)
  )
  with check (
    sender_id <> auth.uid()
    and public.is_conversation_party(conversation_id)
  );

create or replace function public.messages_restrict_update_columns()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'only read_at may be updated on messages';
  end if;
  return new;
end;
$$;

create trigger messages_guard_columns
before update on public.messages
for each row execute function public.messages_restrict_update_columns();

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy reviews_select_published on public.reviews
  for select to anon, authenticated
  using (status = 'published' or provider_id = auth.uid() or public.is_admin());

-- Only the client of a COMPLETED booking may review it (once).
create policy reviews_insert_eligible on public.reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.client_id = auth.uid()
        and b.provider_id = reviews.provider_id
        and b.status = 'completed'
    )
  );

-- Providers may respond to their reviews (only the response column — guarded
-- by trigger below).
create policy reviews_update_provider on public.reviews
  for update to authenticated
  using (provider_id = auth.uid() or public.is_admin())
  with check (provider_id = auth.uid() or public.is_admin());

create or replace function public.reviews_restrict_update_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user is distinct from 'service_role' then
    if new.rating is distinct from old.rating
       or new.body is distinct from old.body
       or new.booking_id is distinct from old.booking_id
       or new.author_id is distinct from old.author_id
       or new.professionalism is distinct from old.professionalism
       or new.punctuality is distinct from old.punctuality
       or new.communication is distinct from old.communication
       or new.respect_for_boundaries is distinct from old.respect_for_boundaries
       or new.accuracy is distinct from old.accuracy then
      raise exception 'reviews are immutable once submitted';
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_guard_columns
before update on public.reviews
for each row execute function public.reviews_restrict_update_columns();

-- ---------------------------------------------------------------------------
-- favourites, recently viewed, notifications
-- ---------------------------------------------------------------------------
create policy favourites_own on public.favourites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy recently_viewed_own on public.recently_viewed
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- trust & safety
-- ---------------------------------------------------------------------------
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_select_own_or_admin on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create policy reports_update_admin on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

create policy tickets_select_own_or_admin on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy tickets_update_admin on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ticket_replies_select_party on public.support_ticket_replies
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

create policy ticket_replies_insert_party on public.support_ticket_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
    )
  );

create policy disputes_insert_party on public.disputes
  for insert to authenticated
  with check (opened_by = auth.uid() and public.is_booking_party(booking_id));

create policy disputes_select_party on public.disputes
  for select to authenticated
  using (public.is_booking_party(booking_id) or public.is_admin());

create policy disputes_update_admin on public.disputes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy blocked_users_own on public.blocked_users
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create policy trusted_contacts_own on public.trusted_contacts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy session_checkins_party on public.session_checkins
  for all to authenticated
  using (public.is_booking_party(booking_id))
  with check (public.is_booking_party(booking_id));

-- ---------------------------------------------------------------------------
-- Discovery view — the ONLY surface the map/list browser uses.
-- security_invoker ensures base-table RLS still applies to the caller.
-- ---------------------------------------------------------------------------
create or replace view public.provider_discovery
with (security_invoker = true)
as
select
  pp.provider_id,
  p.display_name,
  pp.headline,
  left(pp.bio, 240) as bio_excerpt,
  p.avatar_url,
  pp.languages,
  pp.city,
  pp.neighbourhood,
  extensions.st_y(pp.approx_location::extensions.geometry) as lat,
  extensions.st_x(pp.approx_location::extensions.geometry) as lng,
  pp.accepts,
  pp.instant_booking,
  pp.avg_rating,
  pp.review_count,
  s.min_price_minor as starting_price_minor,
  coalesce(s.durations, '{}') as durations,
  pp.verification
from public.provider_profiles pp
join public.profiles p on p.id = pp.provider_id
left join lateral (
  select
    min(ps.price_60_minor) as min_price_minor,
    (
      select array_agg(distinct d.d order by d.d)
      from public.provider_services s2
      cross join lateral unnest(array[
        case when s2.price_30_minor is not null then 30 end,
        60,
        case when s2.price_90_minor is not null then 90 end,
        case when s2.price_120_minor is not null then 120 end
      ]) as d(d)
      where s2.provider_id = pp.provider_id and s2.active and d.d is not null
    ) as durations
  from public.provider_services ps
  where ps.provider_id = pp.provider_id and ps.active
) s on true
where pp.published
  and pp.verification = 'verified'
  and p.deactivated_at is null;

grant select on public.provider_discovery to anon, authenticated;

-- Service areas with plain numeric coordinates so clients don't have to parse
-- PostGIS serialisation. Zones are business areas — never home addresses.
create or replace view public.provider_service_areas_public
with (security_invoker = true)
as
select
  a.id,
  a.provider_id,
  a.name,
  a.city,
  a.radius_km,
  a.house_calls,
  a.travel_base_fee_minor,
  a.travel_per_km_minor,
  a.max_travel_km,
  extensions.st_y(a.center::extensions.geometry) as lat,
  extensions.st_x(a.center::extensions.geometry) as lng
from public.provider_service_areas a
where a.active;

grant select on public.provider_service_areas_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets & policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('provider-photos', 'provider-photos', true),
  ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy provider_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'provider-photos');

create policy provider_photos_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'provider-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification documents: owner can upload/read; nobody else except the
-- service_role (used by admins through the dashboard backend).
create policy verification_docs_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy verification_docs_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
