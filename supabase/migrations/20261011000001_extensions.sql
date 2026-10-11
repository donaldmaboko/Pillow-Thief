-- Pillow Thief :: extensions
-- btree_gist  : exclusion constraints for double-booking prevention
-- postgis     : spatial queries for provider discovery / service areas
-- pgcrypto    : gen_salt for seeded dev credentials
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase places extensions in the `extensions` schema, which is already on
-- the default search path. Spatial types below are referenced as
-- extensions.geometry / extensions.geography for clarity.
