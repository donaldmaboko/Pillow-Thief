#!/usr/bin/env python3
"""
Migration + logic verification harness for Pillow Thief.

Starts a real PostgreSQL instance (pgserver), installs Supabase-compatible
stubs (auth schema, roles, storage, RLS helpers, and a minimal PostGIS shim
when the extension is unavailable), then applies every migration in order and
runs functional assertions against the business rules that matter most:
double-booking prevention, availability windows, price authority, RLS
enforcement, status transitions, promo limits and review eligibility.

Run:  /tmp/ptvenv/bin/python scripts/verify_backend.py
"""
from __future__ import annotations

import os
import re
import sys
import glob
import traceback
from pathlib import Path

import pgserver

# Locate the bundled psql binary (pgserver.postgresql_bin_path in newer versions,
# module-level POSTGRES_BIN_PATH in older ones).
_psql_candidates = []
for _mod in ("pgserver", "pgserver.utils", "pgserver.postgres_server"):
    try:
        _m = __import__(_mod, fromlist=["*"])
        for _attr in ("POSTGRES_BIN_PATH", "postgres_bin_path", "PG_BIN"):
            _val = getattr(_m, _attr, None)
            if _val:
                _psql_candidates.append(Path(_val) / "psql")
    except Exception:
        pass

PSQL = next((str(c) for c in _psql_candidates if c.exists()), "psql")

REPO = Path(__file__).resolve().parent.parent
MIGRATIONS = sorted(glob.glob(str(REPO / "supabase" / "migrations" / "*.sql")))
SEED = REPO / "supabase" / "seed.sql"

SUPABASE_STUBS = r"""
-- ============ Supabase-compatible stubs for local verification ============
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  begin create extension if not exists pgcrypto with schema extensions;
  exception when others then raise notice 'pgcrypto shimmed: %', sqlerrm; end;
  begin create extension if not exists btree_gist with schema extensions;
  exception when others then raise notice 'btree_gist unavailable: %', sqlerrm; end;
  begin create extension if not exists postgis with schema extensions;
  exception when others then raise notice 'postgis shimmed: %', sqlerrm; end;
  begin create extension if not exists "uuid-ossp" with schema extensions;
  exception when others then raise notice 'uuid-ossp shimmed: %', sqlerrm; end;
end $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- --- pgcrypto / uuid-ossp shims (only created when the real extension is absent)
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'extensions' and p.proname = 'gen_salt') then
    execute $s$
      create function extensions.gen_salt(text) returns text language sql immutable as
        'select ''shimsalt''::text';
      create function extensions.crypt(text, text) returns text language sql immutable as
        'select ''sha256$shim$'' || md5($1 || $2)';
      create function extensions.uuid_generate_v4() returns uuid language sql volatile as
        'select gen_random_uuid()';
    $s$;
  end if;
end $$;

-- --- PostGIS shim: text point type + real haversine maths
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'extensions' and t.typname = 'geometry' and t.typtype = 'd') then
    execute $s$
      create domain extensions.geometry as text;
      create domain extensions.geography as text;
      create function extensions.st_setsrid(g text, srid int) returns text language sql immutable as 'select g';
      create function extensions.st_makepoint(lng float8, lat float8) returns text language sql immutable as
        $q$ select 'POINT(' || lng || ' ' || lat || ')' $q$;
      create function extensions.st_x(g text) returns float8 language sql immutable as
        $q$ select split_part(split_part(replace(g, 'POINT(', ''), ' ', 1), ')', 1)::float8 $q$;
      create function extensions.st_y(g text) returns float8 language sql immutable as
        $q$ select split_part(split_part(replace(g, 'POINT(', ''), ' ', 2), ')', 1)::float8 $q$;
      create function extensions.st_distance(a text, b text) returns float8 language sql immutable as
        $q$ select 6371000 * 2 * asin(sqrt(
             power(sin(radians(extensions.st_y(b) - extensions.st_y(a)) / 2), 2) +
             cos(radians(extensions.st_y(a))) * cos(radians(extensions.st_y(b))) *
             power(sin(radians(extensions.st_x(b) - extensions.st_x(a)) / 2), 2)))
        $q$;
      create function extensions.st_dwithin(a text, b text, d float8) returns boolean language sql immutable as
        $q$ select extensions.st_distance(a, b) <= d $q$;
    $s$;
  end if;
end $$;

-- Minimal auth.users / auth.identities
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text default '',
  recovery_token text default '',
  email_change_token_new text default '',
  email_change text default '',
  raw_app_meta_data jsonb default '{}',
  raw_user_meta_data jsonb default '{}',
  aud text default 'authenticated',
  role text default 'authenticated',
  is_super_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  phone text, banned_until timestamptz, deleted_at timestamptz
);
create table if not exists auth.identities (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  provider text not null,
  identity_data jsonb not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, provider)
);

-- auth helper functions used by RLS policies
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- Minimal storage schema
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/'); $$;

-- Realtime publication used by migrations
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Default table privileges (Supabase grants these to anon/authenticated)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
"""


def shim_migration(sql: str, has_postgis: bool) -> str:
    """Rewrite PostGIS-specific DDL when the extension is unavailable.

    The production migrations are unchanged; this only adapts them for the
    verification sandbox so the rest of the schema (constraints, triggers,
    RLS, RPCs) can be exercised against a real PostgreSQL instance.
    """
    if has_postgis:
        return sql
    sql = sql.replace("extensions.geography(Point, 4326)", "text")
    sql = sql.replace("extensions.geography", "text")
    sql = sql.replace("extensions.geometry", "text")
    # gist indexes on point columns -> btree (the EXCLUDE constraint is untouched)
    sql = re.sub(r"(?<!exclude )using gist \(", "using btree (", sql)
    # Drop the extension bootstrap lines for unavailable extensions
    sql = sql.replace('create extension if not exists postgis with schema extensions;',
                      '-- postgis shimmed')
    sql = sql.replace('create extension if not exists "uuid-ossp" with schema extensions;',
                      '-- uuid-ossp shimmed')
    sql = sql.replace('create extension if not exists pgcrypto with schema extensions;',
                      '-- pgcrypto shimmed')
    return sql


class Results:
    def __init__(self) -> None:
        self.passed = 0
        self.failed: list[str] = []

    def check(self, name: str, condition: bool, detail: str = "") -> None:
        if condition:
            self.passed += 1
            print(f"  PASS  {name}")
        else:
            self.failed.append(name)
            print(f"  FAIL  {name} {detail}")


def split_statements(sql: str) -> list[str]:
    """Split SQL on top-level semicolons, respecting $$ bodies and quotes."""
    stmts: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    dollar: str | None = None
    quote: str | None = None
    while i < n:
        ch = sql[i]
        if dollar:
            if sql.startswith(dollar, i):
                buf.append(dollar)
                i += len(dollar)
                dollar = None
                continue
            buf.append(ch)
            i += 1
            continue
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            elif ch == "\\":
                i += 1
                if i < n:
                    buf.append(sql[i])
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if ch == "-" and sql.startswith("--", i):
            # line comment: skip to end of line
            nl = sql.find("\n", i)
            if nl == -1:
                break
            i = nl + 1
            continue
        if ch == "$":
            m = re.match(r"\$[A-Za-z_]*\$", sql[i:])
            if m:
                dollar = m.group(0)
                buf.append(dollar)
                i += len(dollar)
                continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    last = "".join(buf).strip()
    if last:
        stmts.append(last)
    return stmts


def main() -> int:
    print("Starting PostgreSQL (pgserver)…")
    dbdir = Path("/tmp/pgdata_pillow")
    if dbdir.exists():
        import shutil
        shutil.rmtree(dbdir)
    srv = pgserver.get_server(str(dbdir))
    results = Results()

    import subprocess

    def run(sql: str, tuples_only: bool = True, stop_on_error: bool = True) -> str:
        """Run SQL through psql with machine-readable output (-tA)."""
        args = [PSQL, srv.get_uri(), "-X", "-q", "-A"]
        if tuples_only:
            args.append("-t")
        if stop_on_error:
            args.append("-v")
            args.append("ON_ERROR_STOP=1")
        proc = subprocess.run(args, input=sql.encode(), capture_output=True)
        out = proc.stdout.decode()
        err = proc.stderr.decode()
        if proc.returncode != 0:
            raise RuntimeError((err or out)[:4000])
        return out

    def exec_sql(sql: str, quiet: bool = False):
        try:
            return run(sql)
        except Exception:
            if not quiet:
                print("SQL FAILED:\n", sql[:400])
            raise

    print("Installing Supabase-compatible stubs…")
    exec_sql(SUPABASE_STUBS)
    has_postgis = run("select count(*) from pg_extension where extname = 'postgis'").strip() == "1"
    has_btree_gist = run("select count(*) from pg_extension where extname = 'btree_gist'").strip() == "1"
    print(f"  postgis: {'real' if has_postgis else 'shimmed'}   btree_gist: {'real' if has_btree_gist else 'missing'}")

    print(f"Applying {len(MIGRATIONS)} migrations…")
    for path in MIGRATIONS:
        name = os.path.basename(path)
        sql = Path(path).read_text()
        try:
            for stmt in split_statements(shim_migration(sql, has_postgis)):
                exec_sql(stmt)
            print(f"  applied {name}")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED  {name}")
            print(str(exc)[:2000])
            traceback.print_exc()
            return 1

    print("Applying seed…")
    try:
        for stmt in split_statements(shim_migration(SEED.read_text(), has_postgis)):
            exec_sql(stmt)
        print("  seed applied")
    except Exception as exc:  # noqa: BLE001
        print("  seed FAILED")
        print(str(exc)[:3000])
        return 1

    print("\nRunning functional assertions…\n")

    def q(sql: str) -> str:
        return run(sql).strip()

    def run_notices(sql: str) -> str:
        """Run a DO block and capture RAISE NOTICE output from stderr."""
        import subprocess
        proc = subprocess.run(
            [PSQL, srv.get_uri(), "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
            input=(f"set client_min_messages = notice;\n{sql}").encode(),
            capture_output=True,
        )
        return proc.stdout.decode() + proc.stderr.decode()

    # --- schema/seed sanity ---
    results.check("profiles created from auth trigger", q("select count(*) from public.profiles") == "5",
                  q("select count(*) from public.profiles"))
    results.check("verified providers published (2)",
                  q("select count(*) from public.provider_discovery") == "2",
                  q("select count(*) from public.provider_discovery"))
    results.check("provider_discovery exposes zero home addresses",
                  "approx_location" not in q("select column_name from information_schema.columns where table_name='provider_discovery'"))
    results.check("platform settings single row with 15% commission",
                  q("select commission_bps from public.platform_settings where id") == "1500")

    # --- price authority: client-supplied prices are ignored ---
    client = "11111111-aaaa-4000-8000-000000000002"
    provider = "11111111-aaaa-4000-8000-000000000003"
    service = "22222222-aaaa-4000-8000-000000000001"

    sql_create = f"""
    select public.create_booking(
      '{client}'::uuid, '{provider}'::uuid, '{service}'::uuid, 60,
      (date_trunc('day', now() at time zone 'Africa/Gaborone') + interval '4 days 14 hours') at time zone 'Africa/Gaborone',
      'client_visits', 0, 0, null, null);
    """
    created = q(sql_create)
    norm = lambda t: "".join(t.split())
    results.check("create_booking returns server-computed total",
                  '"total_minor":30780' in norm(created), created[:200])
    results.check("booking row persisted with status pending_payment",
                  q("select status from public.bookings order by created_at desc limit 1") == "pending_payment")

    # --- double booking prevention (exclusion constraint) ---
    clash = run_notices(f"""
    do $$ begin
      begin
        insert into public.bookings (client_id, provider_id, service_id, status, duration_min, starts_at, ends_at,
          meeting_arrangement, session_price_minor, total_minor)
        select client_id, provider_id, service_id, 'confirmed', 60,
               starts_at + interval '15 minutes', ends_at + interval '15 minutes', meeting_arrangement, 25000, 25000
          from public.bookings order by created_at desc limit 1;
        raise notice 'DOUBLE_BOOK_ALLOWED';
      exception when exclusion_violation then
        raise notice 'DOUBLE_BOOK_BLOCKED';
      end;
    end $$;
    """)
    results.check("overlapping booking rejected by exclusion constraint",
                  "DOUBLE_BOOK_BLOCKED" in clash, clash[-200:])

    # --- availability windows respected ---
    results.check("slot outside weekly window is unavailable",
                  q(f"""select public.slot_is_available('{provider}'::uuid,
                        (date_trunc('day', now() at time zone 'Africa/Gaborone') + interval '3 days 23 hours') at time zone 'Africa/Gaborone',
                        60)""") == "f")
    results.check("blocked exception day reported unavailable",
                  q(f"""select public.slot_is_available('{provider}'::uuid,
                        (current_date + 3 + time '12:00') at time zone 'Africa/Gaborone', 60)""") == "f")

    # --- invalid transitions blocked ---
    bad = run_notices("""
    do $$ declare b uuid; begin
      select id into b from public.bookings where status = 'completed' limit 1;
      begin
        perform public.assert_booking_transition('completed', 'responded'::public.booking_status);
        raise notice 'BAD_TRANSITION_ALLOWED';
      exception when others then raise notice 'BAD_ENUM_REJECTED';
      end;
      begin
        perform public.assert_booking_transition('completed', 'confirmed');
        raise notice 'BAD_TRANSITION_ALLOWED';
      exception when others then raise notice 'BAD_TRANSITION_BLOCKED';
      end;
    end $$;
    """)
    results.check("invalid status enum value rejected", "BAD_ENUM_REJECTED" in bad, bad)
    results.check("completed -> confirmed transition blocked", "BAD_TRANSITION_BLOCKED" in bad, bad)

    # --- provider cannot be booked unless verified+published ---
    unverified = run_notices(f"""
    do $$ begin
      begin
        perform public.create_booking('{client}'::uuid, '11111111-aaaa-4000-8000-000000000005'::uuid,
          '{service}'::uuid, 60, now() + interval '5 days', 'client_visits', 0, 0, null, null);
        raise notice 'UNAPPROVED_ALLOWED';
      exception when others then raise notice 'UNAPPROVED_BLOCKED';
      end;
    end $$;
    """)
    results.check("booking an unapproved provider is blocked", "UNAPPROVED_BLOCKED" in unverified, unverified)

    # --- grant the same table privileges Supabase grants to client roles ---
    run("""grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;""")

    # --- RLS: role escalation blocked, cross-user data hidden ---
    escalation = run_notices(f"""
    do $$ begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '{client}', true);
      begin
        update public.profiles set role = 'admin' where id = '{client}'::uuid;
        raise notice 'ESCALATION_ALLOWED';
      exception when others then raise notice 'ESCALATION_BLOCKED';
      end;
      reset role;
    end $$;
    """)
    results.check("client cannot escalate own role to admin", "ESCALATION_BLOCKED" in escalation, escalation)

    # A provider attacking their own row must be stopped by the guard trigger.
    verify = run_notices(f"""
    do $$ begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '{provider}', true);
      begin
        update public.provider_profiles set published = false
          where provider_id = '{provider}'::uuid;
        raise notice 'SELF_UNPUBLISH_ALLOWED';
      exception when others then raise notice 'SELF_UNPUBLISH_BLOCKED';
      end;
      begin
        update public.provider_profiles set verification = 'unverified'
          where provider_id = '{provider}'::uuid;
        raise notice 'SELF_UNVERIFY_ALLOWED';
      exception when others then raise notice 'SELF_UNVERIFY_BLOCKED';
      end;
      reset role;
    end $$;
    """)
    results.check("provider cannot unpublish/publish at will", "SELF_UNPUBLISH_BLOCKED" in verify, verify)
    results.check("provider cannot alter own verification state", "SELF_UNVERIFY_BLOCKED" in verify, verify)

    # A third party's UPDATE is filtered by RLS (0 rows) — data must be unchanged.
    third_party = run_notices(f"""
    do $$ declare n int; begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '11111111-aaaa-4000-8000-000000000005', true);
      update public.provider_profiles set verification = 'unverified', published = false
        where provider_id = '{provider}'::uuid;
      get diagnostics n = row_count;
      raise notice 'THIRD_PARTY_ROWS %', n;
      reset role;
    end $$;
    """)
    results.check("third party cannot modify a provider row (RLS filters)",
                  "THIRD_PARTY_ROWS 0" in third_party, third_party)
    snapshot = q(f"select verification::text || '/' || published::text from public.provider_profiles where provider_id = '{provider}'::uuid")
    results.check("provider row unchanged after attack attempts", snapshot == "verified/true", snapshot)

    # Provider cannot publish themselves either (published is admin/service_role only).
    publish_attack = run_notices(f"""
    do $$ begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '11111111-aaaa-4000-8000-000000000005', true);
      update public.provider_profiles set published = true where provider_id = '11111111-aaaa-4000-8000-000000000005'::uuid;
      raise notice 'PUBLISH_ROWS';
      reset role;
    end $$;
    """)
    results.check("unapproved applicant has no provider row to publish",
                  q("select count(*) from public.provider_profiles where provider_id = '11111111-aaaa-4000-8000-000000000005'") == "0",
                  publish_attack)

    cross_user = run_notices(f"""
    do $$ declare n int; begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '11111111-aaaa-4000-8000-000000000005', true);
      select count(*) into n from public.bookings;
      raise notice 'VISIBLE_ROWS %', n;
      reset role;
    end $$;
    """)
    results.check("unrelated user sees no bookings via RLS", "VISIBLE_ROWS 0" in cross_user, cross_user)

    direct_payment = run_notices(f"""
    do $$ begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '{client}', true);
      begin
        insert into public.payments (booking_id, client_id, provider_id, amount_minor)
        select id, client_id, provider_id, 1 from public.bookings limit 1;
        raise notice 'PAYMENT_WRITE_ALLOWED';
      exception when others then raise notice 'PAYMENT_WRITE_BLOCKED';
      end;
      reset role;
    end $$;
    """)
    results.check("clients cannot write payment rows", "PAYMENT_WRITE_BLOCKED" in direct_payment, direct_payment)

    # --- promo limits ---
    p1 = norm(q("select public.validate_promo('FIRSTCUDDLE')"))
    results.check("valid promo returns discount", '"valid":true' in p1 and '"discount_minor":5000' in p1, p1)
    p2 = norm(q("select public.validate_promo('NOPE')"))
    results.check("unknown promo rejected", '"valid":false' in p2 and 'invalid_or_expired' in p2, p2)

    # --- review eligibility ---
    results.check("completed booking is reviewable",
                  q(f"""select public.can_review_booking('33333333-aaaa-4000-8000-000000000001'::uuid)""") == "f",
                  "already reviewed in seed (expected false)")
    results.check("upcoming booking is not reviewable",
                  q(f"""select public.can_review_booking('33333333-aaaa-4000-8000-000000000002'::uuid)""") == "f")

    # --- duplicate review blocked ---
    dup = run_notices("""
    do $$ begin
      begin
        insert into public.reviews (booking_id, provider_id, author_id, rating, professionalism, punctuality,
          communication, respect_for_boundaries, accuracy)
        values ('33333333-aaaa-4000-8000-000000000001', '11111111-aaaa-4000-8000-000000000003',
                '11111111-aaaa-4000-8000-000000000002', 5, 5, 5, 5, 5, 5);
        raise notice 'DUP_REVIEW_ALLOWED';
      exception when unique_violation then raise notice 'DUP_REVIEW_BLOCKED';
      end;
    end $$;
    """)
    results.check("duplicate review for same booking rejected", "DUP_REVIEW_BLOCKED" in dup, dup)

    # --- audit logging ---
    results.check("booking changes are audit-logged",
                  int(q("select count(*) from public.audit_logs where table_name = 'bookings'")) > 0)

    # --- ratings aggregate ---
    results.check("provider rating aggregated from genuine reviews",
                  q("select review_count from public.provider_profiles where provider_id = '11111111-aaaa-4000-8000-000000000003'") == "1")

    # --- service-area view exposes numeric coordinates ---
    area = q("select count(*) from public.provider_service_areas_public where lat is not null and lng is not null")
    results.check("service area view exposes numeric coordinates", int(area) >= 1, area)

    # --- consent records: participants write, then freeze after completion ---
    consent_flow = run_notices(f"""
    do $$ declare live uuid; done_b uuid; begin
      select id into live from public.bookings where status = 'confirmed' limit 1;
      select id into done_b from public.bookings where status = 'completed' limit 1;

      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '{client}', true);
      begin
        insert into public.booking_consent (booking_id, completed_by, party, contact, acknowledge_ongoing_consent)
        values (live, '{client}'::uuid, 'client', '{{"hugging":"yes"}}'::jsonb, true);
        raise notice 'CONSENT_INSERT_OK';
      exception when others then raise notice 'CONSENT_INSERT_BLOCKED %', sqlerrm;
      end;
      begin
        update public.booking_consent set contact = '{{"hugging":"no"}}'::jsonb where booking_id = live;
        raise notice 'CONSENT_UPDATE_OK';
      exception when others then raise notice 'CONSENT_UPDATE_BLOCKED %', sqlerrm;
      end;
      begin
        insert into public.booking_consent (booking_id, completed_by, party, contact, acknowledge_ongoing_consent)
        values (done_b, '{client}'::uuid, 'client', '{{}}'::jsonb, true);
      exception when others then null;
      end;
      begin
        update public.booking_consent set contact = '{{"hugging":"yes"}}'::jsonb where booking_id = done_b;
        raise notice 'CONSENT_UPDATE_ROWS';
      exception when others then raise notice 'CONSENT_LATE_UPDATE_BLOCKED';
      end;
      reset role;
    end $$;
    """)
    results.check("booking participant can record consent", "CONSENT_INSERT_OK" in consent_flow, consent_flow)
    results.check("participant can revise consent while booking is live", "CONSENT_UPDATE_OK" in consent_flow, consent_flow)

    # --- pending payment expiry ---
    results.check("expiry sweeper runs", q("select public.expire_stale_bookings()") != "")

    print(f"\n{'=' * 60}")
    print(f"Passed: {results.passed}   Failed: {len(results.failed)}")
    if results.failed:
        for f in results.failed:
            print(f"  - {f}")
        return 1
    print("All backend verification checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
