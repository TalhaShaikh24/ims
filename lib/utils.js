export const USER_ROLES = ["Super Admin", "Organization Admin", "Manager", "Cashier", "Inventory Manager", "Accountant"];

export const n = (v) => {
  const x = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(x) ? x : 0;
};
export const money = (v) => "PKR " + n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (v) => n(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const round2 = (v) => Math.round(n(v) * 100) / 100;

export function fmtDate(d, withTime = false) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const base = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return withTime ? base + " • " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : base;
}

export function docNo(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

export function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function dateRange(preset) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  switch (preset) {
    case "today": return { from: start, to: end, label: "Today" };
    case "yesterday": { const f = new Date(start); f.setDate(f.getDate() - 1); const t = new Date(end); t.setDate(t.getDate() - 1); return { from: f, to: t, label: "Yesterday" }; }
    case "7d": { const f = new Date(start); f.setDate(f.getDate() - 6); return { from: f, to: end, label: "Last 7 days" }; }
    case "30d": { const f = new Date(start); f.setDate(f.getDate() - 29); return { from: f, to: end, label: "Last 30 days" }; }
    case "month": { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: f, to: end, label: "This month" }; }
    default: return { from: new Date(2000, 0, 1), to: end, label: "All time" };
  }
}
export const inRange = (d, r) => { const t = new Date(d).getTime(); return t >= r.from.getTime() && t <= r.to.getTime(); };
