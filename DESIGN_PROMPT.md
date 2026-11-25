# XonaERP — Redesign Prompt (from deep design analysis of the reference template, 22 Nov 2026)

Reference: https://turbo-draco-dmjz6ck.tmp.now/ — the owner loves THIS design. Match it, do not invent a new look.
Key correction vs the previous attempt: the reference sidebar is WHITE, not dark. The previous dark-slate sidebar was wrong.

## PROMPT (use verbatim as the design brief)

Redesign the XonaERP Next.js app to look exactly like a polished, finished SaaS product with this design system:

### Color tokens
- Primary indigo: #4F46E5 (indigo-600) — active nav, primary buttons, links, invoice numbers. Hover: #4338CA.
- Chart indigo light: #6366F1. Logo gradient: #4F46E5 → #7C3AED (only on the 36px logo square and avatar).
- Page background: #F8FAFC (slate-50). Cards, sidebar, topbar: #FFFFFF.
- Headings: #0F172A (slate-900). Body: #334155. Muted: #64748B (slate-500). Faint/placeholder: #94A3B8 (slate-400).
- Borders: #E2E8F0 / #E5E7EB hairline 1px. Row dividers: #F1F5F9.
- Semantic: emerald #059669 (POS Billing button, Paid), amber #F59E0B (warnings, Supabase pill bg #FEF3C7 text #92400E), red #DC2626 (Overdue/Low Stock, notification badge #EF4444).
- Status pills (rounded-full, 11px, bold, uppercase): Paid/In Stock = bg #DCFCE7 text #15803D; Low Stock/Overdue = bg #FEE2E2 text #DC2626; Pending/Due Soon = bg #FEF3C7 text #B45309.
- KPI icon tints (36-40px rounded-lg square, icon in tint color): indigo bg #EEF2FF icon #4F46E5; emerald bg #ECFDF5 icon #059669; violet bg #F5F3FF icon #7C3AED; red bg #FEF2F2 icon #DC2626; amber bg #FFFBEB icon #D97706; cyan bg #ECFEFF icon #0891B2.

### Typography (Inter, font-sans)
- Page title: 24px, weight 800, #0F172A, tight leading. Subtitle under it: 13-14px, #64748B (branch name inside in indigo semibold).
- Card heading: 15-16px weight 700. Card subtitle: 12-13px #94A3B8.
- KPI label: 11-12px, weight 600, UPPERCASE, tracking-wide, #64748B. KPI value: 26px, weight 800, #0F172A. KPI sub-line: 12-13px #94A3B8.
- Body/table: 13-14px. Amounts: weight 700. Form labels: 13px weight 600 #1F2937, 6px below margin.
- Buttons: 13-14px weight 600. All-caps ONLY for KPI labels, table headers, section labels, status pills.

### Layout & spacing
- Sidebar: 250px, WHITE, right hairline border, sticky full height. Logo row 64px: 36x36 rounded-xl gradient square with white store icon + "Xona" 20px/800 + "ERP" badge (bg #E0E7FF, text #4F46E5, 10-11px/700, rounded-md, px 6px py 2px).
- Sidebar section labels: 10-11px, weight 700, uppercase, tracking-widest, #94A3B8, mt 24px mb 12px. Nav item: 40-44px high, px 12px, icon 18px + label 13-14px/500, item gap 4px, sidebar inner padding 12px. Active: bg #4F46E5, white text, rounded-xl (10-12px), subtle shadow — full pill, NO left bar. Inactive: text #475569, hover bg #F1F5F9.
- Sidebar footer: hairline divider + "Xona POS & Business OS" 12px semibold + "Enterprise v1.0.0 • Supabase" 11px muted.
- Topbar: 64px, white, bottom hairline, sticky. Left: branch selector pill (white, border, rounded-lg, 36px, indigo building icon + name 13px/600 + chevron; dropdown card 260px rounded-14px shadow-lg, header "SELECT OPERATING BRANCH" micro-label, option rows with code sub-line and indigo "Main" pill on selected, selected bg #EEF2FF). Right: emerald "POS Billing" button, amber "Supabase Setup" pill (rounded-full), white "Role: <role>" pill with indigo shield, bell with red count badge, dark-mode toggle, gradient avatar circle with initial + chevron, profile dropdown with Logout.
- Page content: padding 24-32px (p-6/p-8), section gaps 20-24px, fluid width (Settings max-w ~960px centered).
- Dashboard KPI grid: row 1 = 6 cols (xl), row 2 = 4 cols, gap 20px, cards equal height. Charts row: trend 2fr / donut 1fr. Then full-width table card.
- POS: products 2fr / cart 1fr (~390px, sticky).

### Components
- Card: bg white, rounded-2xl (16px), border 1px #E5E7EB, shadow-sm very soft (0 1px 3px rgba(15,23,42,.06)), padding 20px (KPI/table headers).
- KPI card: top row label (left) + tinted icon square (right); value; sub-line. No accent bars.
- Primary button: bg #4F46E5, white, h-10, px-4, rounded-xl (10-12px), 13-14px/600, icon 16-18px left, shadow-sm, hover #4338CA. Green variant: bg #059669. Ghost/Cancel: white/transparent, text #64748B, hover #F3F4F6. Icon buttons 36-40px rounded-lg hover #F1F5F9.
- Inputs/selects/search: h-10, rounded-lg (10px), border #E5E7EB, bg white (settings/sub-panels #F8FAFC), text 14px #0F172A, placeholder #94A3B8, focus: border #6366F1 + ring 2px rgba(99,102,241,.30). Search: left search icon 16px #94A3B8, pl 36px. Select chevron #94A3B8.
- Filter chips: rounded-full, h 32-36px, px 16px, 13px/600; inactive white + border #E5E7EB + text #475569; active bg #4F46E5 white.
- Table: header bg #F8FAFC, 11px/700 uppercase tracking-wider #64748B, cell px 16-24 py 12-16, bottom border #E5E7EB. Rows 56-64px, divider #F1F5F9, hover #F8FAFC, no zebra. First cell (invoice no.) indigo/700. Pagination footer: "Showing 1 to X of Y records" muted left; right 32px square prev/next bordered buttons + "Page 1 of 1".
- Product card (POS): white, rounded-2xl, border; image area ~112px light bg; body p 14-16px; name 14px/600; category 12px muted; price indigo 15-16px/700 + 32px circular indigo "+" button.
- Modal: max-w-2xl (~670px), rounded-2xl, white, shadow-2xl, backdrop #0F172A/55 + slight blur. Header p 20-24px: title 18-20px/700 + subtitle 13px muted + X button 32px. Body p 20-24px, 2-col field grid gap 16px; sub-panels (Pricing & Inventory) bg #F8FAFC border rounded-xl p 16px. Footer: top divider #F1F5F9, p 16-20px, right-aligned Cancel (ghost) + primary with check icon, gap 12px.
- Notifications: right slide-over drawer ~450px white, item cards rounded-xl border p 14-16px, unread indigo dot.
- Charts: trend = smooth area, line #6366F1 2px, fill vertical gradient rgba(99,102,241,.25)→0, only faint horizontal dashed gridlines, axis labels 11px #94A3B8, height ~240px. Donut: stroke width ~22px, hole ~57%, colors [#6366F1, #F59E0B, #10B981, #7C3AED...], legend below in 2 cols: 8px dot + label 13px #475569 + bold % right.
- Icons: Lucide outline, stroke 1.5-2, nav 18px, KPI 20px, buttons 16-18px. No emoji, no filled icons except logo/avatar.
- Dark mode: pure token swap — page #0B1120, sidebar/topbar/cards #1E293B, borders #334155, headings #F8FAFC, muted #94A3B8; indigo/emerald/amber accents unchanged; same radius/spacing.

### Also required in this redesign round (functionality gaps)
- Auth: Supabase Auth. /login page (split-screen: left indigo gradient brand panel with logo + tagline, right white form card — email, password, Sign In button indigo, error toast, link to /register). /register page (name, email, password, creates auth user + profiles row). 
- Route protection: dashboard layout checks session; no session → redirect /login. Session user name/email + role (from profiles) shown in topbar/sidebar; avatar initial from name.
- Logout: in avatar dropdown ("Sign Out") — supabase.auth.signOut() → /login.
- Users page (/users in Admin group): profiles table (name, email, role, branch, status, created) with Add/Edit modal (full name, role select from roles, branch select, active toggle) writing to `profiles`; note in UI that login accounts are created from the Register page / Supabase Auth.
- New migration for `profiles` (id uuid PK references auth.users, email, full_name, role_name default 'Cashier', branch_id FK branches, is_active, created_at) + RLS + grants — as a NEW file in supabase/migrations/, never edit applied ones.

## Rules
- Every value above is mandatory, not a suggestion. If a component cannot match, say why in the report.
- All totals stay computed from Supabase tables; no hardcoded numbers.
- `npm run build` must pass with 0 errors; serve-test the main routes.
