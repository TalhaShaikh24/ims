# XonaERP Revamp — Plan (prepared 22 Nov 2026, awaiting Supabase credentials)

## Goal
Full rebuild: new attractive, neat, clean, highly professional design; easy to use;
EVERY module functional and connected to Supabase (no IndexedDB/local-only data, no per-page hardcoded totals).

## Source of truth rule (fixes all 10 bugs from the 21 Nov analysis)
- All KPIs/totals are COMPUTED from the same Supabase tables at runtime — never stored/hardcoded per page.
- Stock value = SUM(stock * cost) computed live. Margin = AVG of product margins computed live.
- Revenue, payment split, P&L, receivables, payables all derived from sales / sale_items / purchases / expenses.
- Sales create stock_movements + audit_logs rows in the same transaction (RPC).
- Returns must reference an existing sale (FK). Branch_id on every transactional table; branch switcher = real filter.
- Dashboard date filter filters sales AND expenses by date range.

## Design direction
- Clean professional SaaS look: white/slate surfaces, one accent (indigo/violet), Inter-type typography,
  consistent 8px spacing, rounded cards, subtle shadows, no clutter.
- Layout: slim collapsible sidebar (grouped: Operations / Catalog / Procurement / CRM & Accounts / Admin),
  topbar with branch switcher, global search, POS shortcut, notifications, profile.
- Dark mode retained. Fully responsive (hamburger on mobile). Skeleton loaders, empty states, toasts.

## Modules (21 pages from original, all functional)
Dashboard, POS Billing (cart, hold/resume, cash drawer, payment Cash/Card/Wallet, change due, receipt print),
Sales Invoices + detail/print, Sales Returns, Products, Categories & Brands (brands linked to products),
Stock & Inventory (adjust, low-stock, movement audit), Stock Transfers,
Purchases (PO), Purchase Returns, Suppliers & Dues, Customers & Credit,
Expenses, Financials & P&L (payment breakdown, cash drawer), Reports (7 tabs, CSV + print),
Employees, Roles & Permissions (matrix, enforced), Branches, Audit Logs, Settings & Branding, My Profile.
Auth: Supabase Auth login gate (none existed before).

## Project structure & DB change rule (user directive 22 Nov 2026)
- Project root: ~/workspace/xonaerp-revamp/ — app code in src/, DB in supabase/migrations/
- Schema lives INSIDE the project as versioned migrations: supabase/migrations/20261122140000_initial_schema.sql
- Every future DB change = a new migration file in supabase/migrations/, applied via `supabase db push`. Never a loose SQL file outside the project.

## Supabase schema (draft)
organizations, branches, profiles (user+role+branch), roles, permissions/role_permissions,
categories, brands, products, customers, suppliers,
sales, sale_items, sales_returns, purchases, purchase_items, purchase_returns,
stock_transfers, stock_movements, expenses, audit_logs, settings.
RLS on, policies by organization + role.

## Supabase project
- Project URL (received 22 Nov 2026): https://lylptvuwbvfcbxgmkobj.supabase.co
- Anon key: requested via secure card 22 Nov 2026 (stored in Secure Vault, not in files/chat)

## Needed from user to start build
1. Supabase Project URL — e.g. https://xxxxx.supabase.co  (Settings > API) — safe to paste in chat
2. Anon / Publishable key — same page — via secure card, not chat
3. Service Role key (secret) — same page — via secure card only, never chat
If no project exists yet: create one at supabase.com first (free), then give the above.
