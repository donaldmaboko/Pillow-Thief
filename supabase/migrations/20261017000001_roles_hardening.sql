-- ============================================================================
-- Pillow Thief :: Phase 1 — role hardening
-- ----------------------------------------------------------------------------
-- Fixes the defects found in the roles recon:
--
--   1. provider_applications.status was user-writable, so a user could submit
--      or edit an application as 'verified'. Guarded now.
--   2. An admin signing in with a normal JWT could not act: profiles.role,
--      provider_profiles.verification and .published are trigger-protected to
--      service_role/postgres. These RPCs run security-definer (owned by
--      postgres) and are gated by public.is_admin(), so the mobile app never
--      needs the service-role key.
--   3. provider_availability*, service_areas and service_locations write
--      policies had no admin branch, unlike provider_services. Made consistent.
--
-- Everything here is additive. No existing function, policy or column is
-- dropped or renamed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stop self-escalation of application status
-- ---------------------------------------------------------------------------
create or replace function public.protect_application_status()
returns trigger
language plpgsql
as $$
begin
  -- service_role/postgres (backend provisioning) and admins may set any status.
  if current_user not in ('service_role', 'postgres') and not public.is_admin() then
    if tg_op = 'INSERT' and coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'applications must be submitted with status = pending'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      raise exception 'application status is managed by the platform'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists provider_applications_guard_status on public.provider_applications;
create trigger provider_applications_guard_status
before insert or update on public.provider_applications
for each row execute function public.protect_application_status();

-- ---------------------------------------------------------------------------
-- 2. Admin-gated RPCs
-- ---------------------------------------------------------------------------

-- approve | reject | request_more_info
create or replace function public.admin_decide_application(
  p_application uuid,
  p_action      text,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid := auth.uid();
  v_app      public.provider_applications;
  v_status   public.verification_state;
  v_provider uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject', 'request_more_info') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;

  select * into v_app
    from public.provider_applications
   where id = p_application
   for update;
  if not found then
    raise exception 'application % not found', p_application using errcode = 'P0002';
  end if;

  v_provider := v_app.user_id;
  v_status := case p_action
                when 'approve' then 'verified'::public.verification_state
                when 'reject'  then 'rejected'::public.verification_state
                else                'pending'::public.verification_state
              end;

  update public.provider_applications
     set status      = v_status,
         reviewed_by = v_admin,
         reviewed_at = now(),
         review_note = p_note
   where id = p_application;

  if p_action = 'approve' then
    -- Provision / refresh the public provider profile. The protect_* triggers
    -- allow this because current_user is the definer (postgres).
    insert into public.provider_profiles
      (provider_id, headline, bio, languages, city, neighbourhood, accepts,
       verification, published)
    values
      (v_provider,
       left(coalesce(nullif(v_app.bio, ''), 'Companion cuddles'), 120),
       left(v_app.bio, 1500),
       v_app.languages,
       coalesce(nullif(v_app.city, ''), 'Gaborone'),
       v_app.neighbourhood,
       v_app.accepts,
       'verified',
       false)
    on conflict (provider_id) do update
       set verification  = 'verified',
           bio           = excluded.bio,
           languages     = excluded.languages,
           city          = excluded.city,
           neighbourhood = excluded.neighbourhood,
           accepts       = excluded.accepts;

    -- A starter service so the provider is bookable the moment they publish.
    if not exists (select 1 from public.provider_services where provider_id = v_provider) then
      insert into public.provider_services (provider_id, title, description, price_60_minor)
      values (v_provider,
              'Cuddle session',
              'A relaxed, consent-led cuddle session. We agree boundaries together before we start.',
              v_app.base_price_60_minor);
    end if;

    update public.profiles
       set role = 'provider'
     where id = v_provider and role = 'client';
  end if;

  insert into public.notifications (user_id, kind, title, body, data)
  values (
    v_provider,
    'verification',
    case p_action when 'approve' then 'You are verified'
                  when 'reject'  then 'Application not approved'
                  else                'More information needed' end,
    coalesce(p_note,
      case p_action when 'approve' then 'Your provider profile is verified. Add services and publish to appear in discovery.'
                    when 'reject'  then 'Unfortunately your application was not approved.'
                    else                'We need a little more information to continue your application.' end),
    jsonb_build_object('action', p_action, 'application_id', p_application)
  );

  return jsonb_build_object('action', p_action, 'status', v_status, 'provider_id', v_provider);
end $$;

-- suspend | reinstate | publish | unpublish
create or replace function public.admin_set_provider_status(
  p_provider uuid,
  p_action   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification public.verification_state;
  v_published    boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_action not in ('suspend', 'reinstate', 'publish', 'unpublish') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;

  select verification, published into v_verification, v_published
    from public.provider_profiles
   where provider_id = p_provider
   for update;
  if not found then
    raise exception 'provider profile % not found', p_provider using errcode = 'P0002';
  end if;

  if p_action = 'suspend' then
    v_verification := 'suspended';
    v_published := false;
  elsif p_action = 'reinstate' then
    v_verification := 'verified';
  elsif p_action = 'publish' then
    if v_verification <> 'verified' then
      raise exception 'provider must be verified before publishing' using errcode = '22023';
    end if;
    v_published := true;
  else -- unpublish
    v_published := false;
  end if;

  update public.provider_profiles
     set verification = v_verification,
         published    = v_published
   where provider_id = p_provider;

  insert into public.notifications (user_id, kind, title, body, data)
  values (p_provider, 'verification',
          case p_action when 'suspend'   then 'Account suspended'
                        when 'reinstate' then 'Account reinstated'
                        when 'publish'   then 'You are live'
                        else                  'Profile unpublished' end,
          case p_action when 'suspend'   then 'Your provider account has been suspended. Contact support.'
                        when 'reinstate' then 'Your provider account has been reinstated.'
                        when 'publish'   then 'Your profile is now visible in discovery.'
                        else                  'Your profile is no longer visible in discovery.' end,
          jsonb_build_object('action', p_action));

  return jsonb_build_object('action', p_action,
                            'verification', v_verification,
                            'published', v_published);
end $$;

-- Aggregate metrics for the admin console. Read-only, bounded, no row dumps.
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users_total',          (select count(*) from public.profiles),
    'clients',              (select count(*) from public.profiles where role = 'client'),
    'providers',            (select count(*) from public.profiles where role = 'provider'),
    'admins',               (select count(*) from public.profiles where role = 'admin'),
    'applications_pending', (select count(*) from public.provider_applications where status = 'pending'),
    'providers_verified',   (select count(*) from public.provider_profiles where verification = 'verified'),
    'providers_published',  (select count(*) from public.provider_profiles where published),
    'bookings_total',       (select count(*) from public.bookings),
    'bookings_by_status',   (select coalesce(jsonb_object_agg(s.status::text, s.c), '{}'::jsonb)
                               from (select status, count(*) as c from public.bookings group by status) s),
    'gmv_30d_minor',        (select coalesce(sum(total_minor), 0) from public.bookings
                              where created_at > now() - interval '30 days'
                                and status not in ('cancelled', 'declined', 'expired')),
    'commission_30d_minor', (select coalesce(sum(commission_minor), 0) from public.bookings
                              where created_at > now() - interval '30 days'
                                and status not in ('cancelled', 'declined', 'expired')),
    'payouts_pending_minor',(select coalesce(sum(net_minor), 0) from public.provider_payouts where status = 'pending'),
    'open_reports',         (select count(*) from public.reports where status in ('open', 'investigating')),
    'open_disputes',        (select count(*) from public.disputes where status in ('open', 'investigating')),
    'open_tickets',         (select count(*) from public.support_tickets where status in ('open', 'pending_user'))
  ) into v;

  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Consistent admin write grants
-- ---------------------------------------------------------------------------
create policy availability_write_admin on public.provider_availability
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy availability_exceptions_write_admin on public.provider_availability_exceptions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy service_areas_write_admin on public.provider_service_areas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy service_locations_write_admin on public.provider_service_locations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Index audit — every fk plus the columns the new screens filter/sort on
-- ---------------------------------------------------------------------------
create index if not exists bookings_client_idx      on public.bookings (client_id, starts_at desc);
create index if not exists messages_conv_idx        on public.messages (conversation_id, created_at desc);
create index if not exists reports_status_idx       on public.reports (status, created_at desc);
create index if not exists disputes_status_idx      on public.disputes (status, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists notifications_user_idx   on public.notifications (user_id, created_at desc);
create index if not exists applications_status_idx  on public.provider_applications (status, created_at desc);
create index if not exists reviews_provider_idx     on public.reviews (provider_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Grants — authenticated only, never anon. is_admin() is the gate.
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_decide_application(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_provider_status(uuid, text) from public, anon;
revoke execute on function public.admin_metrics() from public, anon;

grant execute on function public.admin_decide_application(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_set_provider_status(uuid, text) to authenticated, service_role;
grant execute on function public.admin_metrics() to authenticated, service_role;
