-- XonaERP Revamp — Migration 20261122140000: initial schema
-- This file lives INSIDE the project (supabase/migrations/). Every future DB change
-- is a NEW migration file in this same folder, never a loose external SQL file.
-- Apply with: supabase db push (CLI, linked to the project) — or paste this file in SQL Editor once for first setup.
-- Idempotent: safe to re-run. All totals in the app are computed from these tables.

create extension if not exists pgcrypto;

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, name text not null, address text, phone text,
  manager_name text, is_main boolean default false, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, description text, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, description text, created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null, name text not null,
  category_id uuid references categories(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  price numeric(12,2) not null default 0, cost numeric(12,2) not null default 0,
  stock numeric(12,2) not null default 0, low_stock_at numeric(12,2) not null default 5,
  description text, image_url text, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, phone text, address text,
  credit_limit numeric(12,2) not null default 0, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact_name text, email text, phone text, address text,
  is_active boolean default true, created_at timestamptz default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, role_name text not null,
  branch_id uuid references branches(id) on delete set null,
  salary numeric(12,2) not null default 0, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  customer_id uuid references customers(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  cashier_name text, payment_method text not null default 'Cash',
  status text not null default 'Paid',
  subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 8.5, tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0, amount_paid numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, price numeric(12,2) not null, cost numeric(12,2) not null default 0,
  qty numeric(12,2) not null, line_total numeric(12,2) not null
);

create table if not exists sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique not null,
  sale_id uuid not null references sales(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(12,2) not null default 0, status text not null default 'Refunded',
  reason text, created_at timestamptz default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  po_no text unique not null,
  supplier_id uuid references suppliers(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'Pending', total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0, order_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, qty numeric(12,2) not null,
  unit_cost numeric(12,2) not null, line_total numeric(12,2) not null
);

create table if not exists purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text unique not null,
  purchase_id uuid references purchases(id) on delete set null,
  amount numeric(12,2) not null default 0, status text not null default 'Processed',
  reason text, created_at timestamptz default now()
);

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text unique not null,
  from_branch_id uuid references branches(id) on delete set null,
  to_branch_id uuid references branches(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  qty numeric(12,2) not null, status text not null default 'Pending',
  notes text, created_at timestamptz default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  type text not null, qty numeric(12,2) not null, ref text, note text,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null, category text not null,
  amount numeric(12,2) not null, payment_method text default 'Cash',
  branch_id uuid references branches(id) on delete set null,
  expense_date date default current_date, notes text, created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text, action text not null, details text, created_at timestamptz default now()
);

create table if not exists app_settings (
  key text primary key, value jsonb not null
);

-- RLS on, starter policies open to anon+authenticated (tighten by role before production launch)
do $$
declare t text;
begin
  foreach t in array array['branches','categories','brands','products','customers','suppliers','employees','sales','sale_items','sales_returns','purchases','purchase_items','purchase_returns','stock_transfers','stock_movements','expenses','audit_logs','app_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "app_all" on %I', t);
    execute format('create policy "app_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Seed: default branch + settings (only if empty)
insert into branches (code, name, is_main) values ('BR-MAIN','Main Flagship Store (Downtown)', true)
on conflict (code) do nothing;

insert into app_settings (key, value) values
  ('org', '{"business_name":"XonaERP","currency":"USD","tax_rate":8.5,"timezone":"America/New_York","email":"","phone":"","address":""}'),
  ('receipt', '{"header":"Thank you for shopping with us!","footer":"Please visit again!","show_logo":true,"show_tax":true,"show_cashier":true}')
on conflict (key) do nothing;
