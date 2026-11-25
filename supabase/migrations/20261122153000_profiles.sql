-- XonaERP Revamp — Migration 20261122153000: user profiles (Supabase Auth)
-- One row per app user: id matches the Supabase Auth user id (auth.users.id) when the
-- profile is created from the Register page; the Users & Access page can also create
-- standalone profiles, so id defaults to gen_random_uuid() instead of a hard FK.
-- Lives inside the project (supabase/migrations/). Idempotent: safe to re-run.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role_name text not null default 'Cashier',
  branch_id uuid references branches(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "app_all" on profiles;
create policy "app_all" on profiles for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on profiles to anon, authenticated;
