"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Inbox, TrendingDown, TrendingUp, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in flex items-start gap-2.5 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_10px_28px_-4px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-800">
            {t.type === "error" ? <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-500" /> : t.type === "warn" ? <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />}
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{t.msg}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Primitives ---------- */
export function Button({ variant = "primary", size = "md", className, ...props }) {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-8 px-2.5 text-[12.5px]", md: "h-9 px-3.5 text-[13px]", lg: "h-10 px-4.5 text-[13.5px]" };
  const variants = {
    primary: "bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.28)] hover:bg-blue-700 active:bg-blue-700",
    green: "bg-emerald-600 text-white shadow-[0_1px_2px_rgba(5,150,105,0.28)] hover:bg-emerald-700 active:bg-emerald-700",
    secondary: "bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    ghost: "text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-[0_1px_2px_rgba(220,38,38,0.25)]",
  };
  return <button className={cn(base, sizes[size] || sizes.md, variants[variant], className)} {...props} />;
}

export function Card({ className, children }) {
  return <div className={cn("rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90", className)}>{children}</div>;
}
export function CardHeader({ title, sub, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
      <div><h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{title}</h3>{sub && <p className="mt-0.5 text-[12px] text-slate-400">{sub}</p>}</div>
      {action}
    </div>
  );
}

const fieldCls = "w-full h-9 rounded-lg border border-slate-200/90 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
export function Input(props) { return <input {...props} className={cn(fieldCls, props.className)} />; }
export function Textarea(props) { return <textarea {...props} className={cn(fieldCls, "h-auto py-2", props.className)} />; }
export function Select({ children, className, ...props }) {
  return (
    <div className={cn("relative", className)}>
      <select {...props} className={cn(fieldCls, "appearance-none pr-8")}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
export function Field({ label, required, action, children, className }) {
  return (
    <div className={cn("block", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{label}{required && <span className="text-red-500"> *</span>}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Badge({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/15 dark:bg-amber-500/15 dark:text-amber-400",
    red: "bg-red-50 text-red-700 ring-1 ring-red-600/15 dark:bg-red-500/15 dark:text-red-400",
    indigo: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300",
    slate: "bg-slate-100 text-slate-600 ring-1 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/15 dark:bg-cyan-500/15 dark:text-cyan-400",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide", tones[tone])}>{children}</span>;
}
export function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (["paid", "received", "refunded", "active", "processed", "completed", "in stock"].includes(s)) return <Badge tone="green">{status}</Badge>;
  if (["pending", "due soon", "in transit", "approved"].includes(s)) return <Badge tone="amber">{status}</Badge>;
  if (["overdue", "low stock", "out of stock", "cancelled", "rejected", "inactive"].includes(s)) return <Badge tone="red">{status}</Badge>;
  return <Badge tone="slate">{status}</Badge>;
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, sub, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 no-print">
      <div className="backdrop-in absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]" onClick={onClose} />
      <div className={cn("modal-in relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-12px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900", wide ? "max-w-3xl" : "max-w-xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div><h2 className="text-[16px] font-bold text-slate-900 dark:text-white">{title}</h2>{sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}</div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Close"><X className="h-4.5 w-4.5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Page scaffolding ---------- */
export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0"><h1 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">{title}</h1>{sub && <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{sub}</p>}</div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{children}</div>}
    </div>
  );
}

const KPI_TONES = {
  indigo: "bg-blue-50 text-blue-600 ring-1 ring-blue-600/10 dark:bg-blue-500/15 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10 dark:bg-emerald-500/15 dark:text-emerald-400",
  violet: "bg-violet-50 text-violet-600 ring-1 ring-violet-600/10 dark:bg-violet-500/15 dark:text-violet-300",
  red: "bg-red-50 text-red-600 ring-1 ring-red-600/10 dark:bg-red-500/15 dark:text-red-400",
  amber: "bg-amber-50 text-amber-600 ring-1 ring-amber-600/10 dark:bg-amber-500/15 dark:text-amber-400",
  cyan: "bg-cyan-50 text-cyan-600 ring-1 ring-cyan-600/10 dark:bg-cyan-500/15 dark:text-cyan-400",
  sky: "bg-sky-50 text-sky-600 ring-1 ring-sky-600/10 dark:bg-sky-500/15 dark:text-sky-400",
  slate: "bg-slate-100 text-slate-500 ring-1 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300",
};
export function StatCard({ label, value, sub, icon: Icon, tone = "indigo", delta, compact }) {
  return (
    <Card className={cn("group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-4px_rgba(15,23,42,0.09)]", compact ? "p-3.5" : "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">{label}</p>
        {Icon && <div className={cn("flex shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", compact ? "h-8 w-8" : "h-9 w-9", KPI_TONES[tone] || KPI_TONES.indigo)}><Icon className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} /></div>}
      </div>
      <p className={cn("tnum truncate font-extrabold leading-none tracking-tight text-slate-900 dark:text-white", compact ? "mt-1.5 text-[20px]" : "mt-2 text-[23px]")}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-[12px] text-slate-400">{sub}</p>}
      {delta != null && (
        <p className={cn("mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold", delta >= 0 ? "text-emerald-600" : "text-red-500")}>
          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} {Math.abs(delta).toFixed(1)}% <span className="font-normal text-slate-400">vs prev</span>
        </p>
      )}
    </Card>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, sub, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Icon className="h-5 w-5" /></div>
      <h3 className="mt-3 text-[13.5px] font-semibold text-slate-900 dark:text-white">{title}</h3>
      {sub && <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">{sub}</p>}
      {children && <div className="mt-3.5">{children}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-9 w-full" style={{ opacity: 1 - i * 0.12 }} />)}</div>;
}

export function SchemaBanner({ error }) {
  if (!error) return null;
  if (error.notConfigured) return (
    <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
      <p><strong>Supabase is not configured yet.</strong> Add your project URL and anon key on the <a className="font-semibold underline" href="/setup">Setup page</a> to load live data.</p>
    </div>
  );
  return (
    <div className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
      <p><strong>Could not load data from Supabase.</strong> {String(error.message || error)} — if the tables are missing, apply the migration in <code className="font-mono text-[12.5px]">supabase/migrations/</code> with <code className="font-mono text-[12.5px]">supabase db push</code>.</p>
    </div>
  );
}

/* ---------- Data table ---------- */
export function DataTable({ columns, rows, loading, empty, pageSize = 10 }) {
  const [page, setPage] = useState(0);
  if (loading) return <SkeletonRows rows={6} />;
  if (!rows?.length) return empty || <EmptyState title="Nothing here yet" sub="Records you add will appear in this table." />;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize);
  const from = cur * pageSize + 1;
  const to = Math.min(rows.length, (cur + 1) * pageSize);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60">
              {columns.map((c, i) => <th key={i} className={cn("px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {slice.map((r, i) => (
              <tr key={r.id || i} className="transition hover:bg-blue-50/35 dark:hover:bg-slate-800/50">
                {columns.map((c, j) => <td key={j} className={cn("px-4 py-2.5 text-slate-600 dark:text-slate-300", c.align === "right" && "tnum text-right font-bold text-slate-800 dark:text-slate-100", c.align === "center" && "text-center", c.emphasis && "font-bold text-blue-600 dark:text-blue-400")}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-slate-500 dark:border-slate-800">
        <span>Showing {from} to {to} of {rows.length} records</span>
        <div className="flex items-center gap-1.5">
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:enabled:hover:bg-slate-800" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-1.5 text-[12px] font-medium">Page {cur + 1} of {pages}</span>
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:enabled:hover:bg-slate-800" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
