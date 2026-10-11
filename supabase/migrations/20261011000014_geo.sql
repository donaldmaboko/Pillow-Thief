-- Pillow Thief :: spatial helpers

-- Provider house-call areas containing a point (used by booking-quote).
create or replace function public.service_areas_containing(
  p_provider uuid,
  p_lat double precision,
  p_lng double precision
)
returns table (
  id uuid,
  name text,
  travel_base_fee_minor bigint,
  travel_per_km_minor bigint,
  max_travel_km numeric
)
language sql
stable
security definer set search_path = public
as $$
  select a.id, a.name, a.travel_base_fee_minor, a.travel_per_km_minor, a.max_travel_km
    from public.provider_service_areas a
   where a.provider_id = p_provider
     and a.active
     and a.house_calls
     and extensions.st_dwithin(
           a.center,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
           a.radius_km * 1000
         );
$$;

-- Approximate distance (km) from a provider's base location to a point.
-- Only used as a UI hint; booking travel fees always come from the Routes API
-- via the booking-quote function.
create or replace function public.provider_distance_km(
  p_provider uuid,
  p_lat double precision,
  p_lng double precision
)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  -- st_distance returns double precision; cast to numeric before rounding
  -- (round(double precision, integer) does not exist in PostgreSQL).
  select round(
    (
      extensions.st_distance(
        pp.approx_location,
        extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
      ) / 1000.0
    )::numeric,
    2
  )
  from public.provider_profiles pp
  where pp.provider_id = p_provider;
$$;

grant execute on function public.service_areas_containing(uuid, double precision, double precision)
  to authenticated, service_role;
grant execute on function public.provider_distance_km(uuid, double precision, double precision)
  to authenticated, service_role;
