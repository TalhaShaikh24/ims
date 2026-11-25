"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight, BarChart3, Bell, Boxes, Building2, Check, ChevronDown, ClipboardList, Cloud,
  CreditCard, FileText, History, KeyRound, LayoutDashboard, LogOut, Maximize2, Menu, Minimize2,
  Moon, Package, PanelLeftClose, PanelLeftOpen, Receipt, RotateCcw, Search, Settings, ShieldCheck,
  ShoppingCart, Store, Sun, Tags, Truck, Undo2, UserRound, Users, Wallet, X,
} from "lucide-react";
import { getConfig, supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/data";
import { cn } from "@/lib/cn";
import { ToastProvider } from "./ui";

export const BranchCtx = createContext({ branches: [], branchId: "all", setBranchId: () => { }, branch: null });
export const useBranch = () => useContext(BranchCtx);
export const AuthCtx = createContext({ user: null, profile: null, configured: false, signOut: async () => { } });
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  {
    group: "Operations", items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "POS Billing", icon: ShoppingCart },
      { href: "/sales", label: "Sales Invoices", icon: FileText },
      { href: "/returns", label: "Sales Returns", icon: Undo2 },
    ]
  },
  {
    group: "Catalog & Inventory", items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories & Brands", icon: Tags },
      { href: "/inventory", label: "Stock & Inventory", icon: Boxes },
      { href: "/stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight },
    ]
  },
  {
    group: "Procurement", items: [
      { href: "/purchases", label: "Purchases (PO)", icon: ClipboardList },
      { href: "/purchase-returns", label: "Purchase Returns", icon: RotateCcw },
      { href: "/suppliers", label: "Suppliers & Dues", icon: Truck },
    ]
  },
  {
    group: "CRM & Accounts", items: [
      { href: "/customers", label: "Customers & Credit", icon: Users },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/financials", label: "Financials & P&L", icon: Wallet },
    ]
  },
  {
    group: "Insights & Admin", items: [
      { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
      { href: "/employees", label: "Employees & Staff", icon: Users },
      { href: "/users", label: "Users & Access", icon: KeyRound },
      { href: "/roles", label: "Roles & Permissions", icon: ShieldCheck },
      { href: "/branches", label: "Branch Locations", icon: Building2 },
      { href: "/audit-logs", label: "Audit Logs", icon: History },
      { href: "/settings", label: "Settings & Branding", icon: Settings },
    ]
  },
];

export function LogoLockup({ light, collapsed }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-[0_2px_10px_rgba(37,99,235,0.4)]">
        <Store className="h-4 w-4 text-white" strokeWidth={2.2} />
      </span>
      {!collapsed && (
        <>
          <span className={cn("text-[18px] font-extrabold leading-none tracking-tight", light ? "text-white" : "text-slate-900 dark:text-white")}>IMS</span>
          <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider", light ? "bg-white/15 text-blue-200 ring-1 ring-white/15" : "bg-blue-50 text-blue-600 ring-1 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300")}>ERP</span>
        </>
      )}
    </span>
  );
}

function Sidebar({ onNavigate, collapsed = false }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col border-r border-slate-800/90 bg-[#0F172A] text-slate-300 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.22)] dark:bg-[#0B101B]">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-white/[0.06]", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/" onClick={onNavigate} title="IMS Dashboard">
          <LogoLockup light collapsed={collapsed} />
        </Link>
      </div>
      <nav className={cn("sidebar-scroll flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-2.5")}>
        {NAV.map((g, gi) => (
          <div key={g.group}>
            {collapsed ? (
              gi > 0 && <div className="mx-2 my-2.5 h-px bg-white/[0.08]" />
            ) : (
              <p className={cn("mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500", gi === 0 ? "mt-0.5" : "mt-4")}>{g.group}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      title={collapsed ? it.label : undefined}
                      className={cn(
                        "group relative flex h-9 items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                        collapsed ? "mx-auto w-10 justify-center px-0" : "gap-2.5 px-2.5",
                        active
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_2px_10px_rgba(37,99,235,0.4)]"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                      )}
                    >
                      <it.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} strokeWidth={1.9} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cn("shrink-0 border-t border-white/[0.06] py-3", collapsed ? "flex justify-center px-2" : "px-4")}>
        {collapsed ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-[10px] font-bold text-emerald-400" title="IMS POS & Business OS v1.0.0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </span>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11.5px] font-semibold text-slate-200">IMS Business OS</p>
              <p className="text-[10.5px] text-slate-500">v1.0.0 • Enterprise</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="System Online" />
          </div>
        )}
      </div>
    </div>
  );
}

function BranchSelector() {
  const { branches, branchId, setBranchId, branch } = useBranch();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button onClick={() => setOpen((v) => !v)} className="flex h-8.5 items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:bg-slate-700/60">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="max-w-[160px] truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-100">{branch?.name || "All Branches"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="dropdown-in absolute left-0 top-10 z-50 w-[250px] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-800">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Operating Branch</p>
          {[{ id: "all", name: "All Branches", code: "Combined view", is_main: false }, ...branches].map((b) => {
            const selected = branchId === b.id;
            return (
              <button key={b.id} onClick={() => { setBranchId(b.id); setOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition", selected ? "bg-blue-50 dark:bg-blue-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-700/60")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-100">{b.name}</span>
                  <span className="block text-[10.5px] text-slate-400">{b.code || ""}</span>
                </span>
                {b.is_main && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9.5px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">Main</span>}
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationsDrawer({ open, onClose, items }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] no-print">
      <div className="backdrop-in absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-[420px] max-w-[92vw] flex-col border-l border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Notifications</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Close notifications"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-slate-400">All caught up — no alerts right now.</p>
          ) : items.map((nt, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">{nt.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{nt.body}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>,
    document.body
  );
}

function Topbar({ onMenu, collapsed, onToggleCollapse }) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [dark, setDark] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [showRes, setShowRes] = useState(false);
  const [lowItems, setLowItems] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchRef = useRef(null);

  const displayName = profile?.full_name || user?.email || "Admin";
  const role = profile?.role_name || "Super Admin";
  const initial = (displayName || "A").trim().charAt(0).toUpperCase();

  useEffect(() => {
    const saved = localStorage.getItem("xona_theme");
    if (saved === "dark") { document.documentElement.classList.add("dark"); setDark(true); }
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const sb = supabase(); if (!sb) return;
      const { data } = await sb.from("products").select("name,stock,low_stock_at");
      const low = (data || []).filter((p) => Number(p.stock) <= Number(p.low_stock_at));
      setLowItems(low.map((p) => ({ title: "Low Stock Alert", body: `${p.name} is at or below its reorder level — ${Number(p.stock)} left (reorder at ${Number(p.low_stock_at)}).` })));
    })();
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const sb = supabase(); if (!sb) return;
      const s = q.toLowerCase();
      const [{ data: prods }, { data: custs }, { data: sales }] = await Promise.all([
        sb.from("products").select("id,name,sku").limit(25),
        sb.from("customers").select("id,name").limit(25),
        sb.from("sales").select("id,invoice_no").limit(25),
      ]);
      const out = [];
      (prods || []).filter((p) => (p.name + p.sku).toLowerCase().includes(s)).slice(0, 4).forEach((p) => out.push({ label: p.name, tag: "Product", href: "/products" }));
      (custs || []).filter((c) => c.name.toLowerCase().includes(s)).slice(0, 3).forEach((c) => out.push({ label: c.name, tag: "Customer", href: "/customers" }));
      (sales || []).filter((x) => x.invoice_no.toLowerCase().includes(s)).slice(0, 3).forEach((x) => out.push({ label: x.invoice_no, tag: "Invoice", href: `/sales/${x.id}` }));
      setResults(out);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  function toggleDark() {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("xona_theme", next ? "dark" : "light");
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore if browser blocks fullscreen */
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 no-print">
      <div className="flex h-14 items-center gap-2.5 px-4 sm:px-5 lg:px-6">
        <button onClick={onMenu} className="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Menu"><Menu className="h-4.5 w-4.5" /></button>
        <button
          onClick={onToggleCollapse}
          className="hidden h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white lg:flex"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <div className="hidden md:block"><BranchSelector /></div>
        <div className="relative hidden w-full max-w-xs lg:block xl:max-w-sm" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowRes(false); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setShowRes(true); }} onFocus={() => setShowRes(true)} placeholder="Search products, customers, invoices…" className="h-8.5 w-full rounded-lg border border-slate-200/90 bg-slate-50/70 pl-8.5 pr-12 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-800" />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-700">⌘K</kbd>
          {showRes && results.length > 0 && (
            <div className="absolute left-0 right-0 top-10 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-800">
              {results.map((r, i) => (
                <button key={i} onClick={() => { router.push(r.href); setShowRes(false); setQ(""); }} className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition hover:bg-slate-50 dark:hover:bg-slate-700/60">
                  <span className="font-medium text-slate-700 dark:text-slate-100">{r.label}</span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{r.tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden h-8 items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/80 px-2.5 text-[12px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> {role}
          </span>
          <Link href="/pos" className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12.5px] font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.28)] transition hover:bg-emerald-700">
            <CreditCard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">POS Billing</span>
          </Link>
          <button
            onClick={toggleFullscreen}
            className="hidden h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:flex"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={() => setShowNotif(true)} className="relative flex h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Notifications" title="Notifications">
            <Bell className="h-4 w-4" />
            {lowItems.length > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white shadow-sm">{lowItems.length}</span>}
          </button>
          <button onClick={toggleDark} className="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Toggle theme" title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowProfile(false); }}>
            <button onClick={() => setShowProfile((v) => !v)} className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-bold text-white shadow-sm">{initial}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {showProfile && (
              <div className="dropdown-in absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-700">
                  <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{displayName}</p>
                  <p className="truncate text-[11.5px] text-slate-400">{user?.email || profile?.email || ""}</p>
                  <span className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">{role}</span>
                </div>
                <Link href="/profile" onClick={() => setShowProfile(false)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"><UserRound className="h-4 w-4 text-slate-400" /> My Profile</Link>
                <button onClick={async () => { setShowProfile(false); await signOut(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"><LogOut className="h-4 w-4" /> Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <NotificationsDrawer open={showNotif} onClose={() => setShowNotif(false)} items={lowItems} />
    </header>
  );
}

export default function Shell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchIdState] = useState("all");
  const [configured] = useState(() => getConfig().configured);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("xona_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("xona_sidebar_collapsed", String(next));
      return next;
    });
  };

  const loadProfile = useCallback(async (u) => {
    if (!u) { setProfile(null); return; }
    const p = await fetchProfile(u.id);
    setProfile(p);
    if (typeof window !== "undefined") {
      if (p?.full_name) localStorage.setItem("xona_profile_name", p.full_name);
      if (u.email) localStorage.setItem("xona_profile_email", u.email);
    }
  }, []);

  /* Auth guard — only enforced when Supabase IS configured. */
  useEffect(() => {
    if (!configured) { setAuthChecked(true); return; }
    const sb = supabase();
    if (!sb) { setAuthChecked(true); return; }
    let alive = true;
    sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const sessionUser = data?.session?.user || null;
      setUser(sessionUser);
      if (!sessionUser) { router.replace("/login"); return; }
      await loadProfile(sessionUser);
      if (alive) setAuthChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      if (!sessionUser) {
        setProfile(null);
        if (event === "SIGNED_OUT" || event === "USER_DELETED") router.replace("/login");
        else router.replace("/login");
        return;
      }
      await loadProfile(sessionUser);
      setAuthChecked(true);
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    setBranchIdState(localStorage.getItem("xona_branch") || "all");
    (async () => {
      const sb = supabase(); if (!sb) return;
      const { data } = await sb.from("branches").select("*").order("is_main", { ascending: false });
      if (data) setBranches(data);
    })();
  }, []);
  const setBranchId = (id) => { setBranchIdState(id); localStorage.setItem("xona_branch", id); };
  const branch = useMemo(() => branches.find((b) => b.id === branchId) || null, [branches, branchId]);

  const signOut = useCallback(async () => {
    const sb = supabase();
    try { if (sb) await sb.auth.signOut(); } catch { /* ignore */ }
    setUser(null); setProfile(null);
    router.replace("/login");
  }, [router]);

  if (configured && !authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] dark:bg-[#090D16]">
        <div className="flex flex-col items-center gap-4">
          <LogoLockup />
          <div className="skeleton h-2 w-40" />
          <p className="text-[13px] text-slate-400">Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AuthCtx.Provider value={{ user, profile, configured, signOut }}>
        <BranchCtx.Provider value={{ branches, branchId, setBranchId, branch }}>
          <div className="flex min-h-screen">
            <aside className={cn("fixed inset-y-0 left-0 z-50 hidden transition-all duration-200 ease-out lg:block no-print", collapsed ? "w-[68px]" : "w-[236px]")}>
              <Sidebar collapsed={collapsed} />
            </aside>
            {mobileOpen && (
              <div className="fixed inset-0 z-[60] lg:hidden">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
                <aside className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col shadow-2xl">
                  <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close menu"><X className="h-4.5 w-4.5" /></button>
                  <div className="border-b border-white/[0.06] bg-[#0F172A] px-3 py-2.5 md:hidden dark:bg-[#0B101B]">
                    <BranchSelector />
                  </div>
                  <div className="min-h-0 flex-1">
                    <Sidebar onNavigate={() => setMobileOpen(false)} />
                  </div>
                </aside>
              </div>
            )}
            <div className={cn("flex min-w-0 flex-1 flex-col overflow-x-hidden transition-all duration-200 ease-out", collapsed ? "lg:pl-[68px]" : "lg:pl-[236px]")}>
              <Topbar onMenu={() => setMobileOpen(true)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
              <main className="w-full flex-1 px-4 py-4 sm:px-5 lg:px-6">{children}</main>
            </div>
          </div>
        </BranchCtx.Provider>
      </AuthCtx.Provider>
    </ToastProvider>
  );
}
