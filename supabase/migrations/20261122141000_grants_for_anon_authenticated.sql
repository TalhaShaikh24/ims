-- XonaERP Revamp — Migration 20261122141000: table privileges for API roles
-- Tables created through the Management API do not automatically get privileges
-- for anon/authenticated in this project, so PostgREST returned 42501 (permission denied)
-- even though RLS policies exist. Grant the privileges; RLS policies still apply on top.
-- Lives inside the project (supabase/migrations/). Applied via Management API query endpoint.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
