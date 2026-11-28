"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, CreditCard, Landmark, Package, Receipt, ShoppingCart, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useTable } from "@/lib/data";
import { dateRange, fmtDate, inRange, money, n } from "@/lib/utils";
import { useBranch } from "@/components/Shell";
import { Button, Card, CardHeader, EmptyState, PageHeader, SchemaBanner, Select, StatCard, statusBadge } from "@/components/ui";
import { CategoryDonut, SalesAreaChart } from "@/components/Charts";

const PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["month", "This Month"], ["all", "All Time"]];

export default function DashboardPage() {
  const { branchId, branch } = useBranch();
  const [preset, setPreset] = useState("30d");
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const itemsQ = useTable("sale_items");
  const expQ = useTable("expenses", (q) => q.order("expense_date", { ascending: false }));
  const prodQ = useTable("products");
  const custQ = useTable("customers");
  const purchQ = useTable("purchases");
  const catQ = useTable("categories");
  const suppQ = useTable("suppliers");

  const loading = salesQ.loading || itemsQ.loading || expQ.loading || prodQ.loading;
  const error = salesQ.error || expQ.error || prodQ.error;

  const d = useMemo(() => {
    const range = dateRange(preset);
    const span = range.to - range.from;
    const prev = { from: new Date(range.from.getTime() - span), to: range.from };
    const byBranch = (rows, key = "branch_id") => branchId === "all" ? rows : rows.filter((r) => r[key] === branchId || r[key] == null);
    const sales = byBranch(salesQ.rows).filter((s) => inRange(s.created_at, range));
    const salesPrev = byBranch(salesQ.rows).filter((s) => inRange(s.created_at, prev));
    const expenses = byBranch(expQ.rows).filter((e) => inRange(e.expense_date || e.created_at, range));
    const saleIds = new Set(sales.map((s) => s.id));
    const items = itemsQ.rows.filter((i) => saleIds.has(i.sale_id));
    const revenue = sales.reduce((a, s) => a + n(s.total), 0);
    const tax = sales.reduce((a, s) => a + n(s.tax_amount), 0);
    const cogs = items.reduce((a, i) => a + n(i.cost) * n(i.qty), 0);
    const gross = revenue - tax - cogs;
    const expTotal = expenses.reduce((a, e) => a + n(e.amount), 0);
    const allSales = byBranch(salesQ.rows);
    const dues = allSales.reduce((a, s) => a + Math.max(0, n(s.total) - n(s.amount_paid)), 0);
    const payables = purchQ.rows.reduce((a, p) => a + Math.max(0, n(p.total) - n(p.amount_paid)), 0);
    const products = prodQ.rows;
    const invValue = products.reduce((a, p) => a + n(p.stock) * n(p.cost), 0);
    const invRetail = products.reduce((a, p) => a + n(p.stock) * n(p.price), 0);
    const lowStock = products.filter((p) => n(p.stock) <= n(p.low_stock_at));
    const delta = (cur, old) => old > 0 ? ((cur - old) / old) * 100 : null;
    const revPrev = salesPrev.reduce((a, s) => a + n(s.total), 0);

    // trend by day across the selected range (max 31 buckets)
    const days = [];
    const dayMs = 86400000;
    const buckets = Math.min(31, Math.max(1, Math.ceil(span / dayMs)));
    for (let i = buckets - 1; i >= 0; i--) {
      const dayStart = new Date(range.to.getTime() - i * dayMs); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + dayMs);
      const sum = sales.filter((s) => { const t = new Date(s.created_at); return t >= dayStart && t < dayEnd; }).reduce((a, s) => a + n(s.total), 0);
      days.push({ day: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), sales: Math.round(sum * 100) / 100 });
    }
    // category share from real items
    const catName = new Map(catQ.rows.map((c) => [c.id, c.name]));
    const prodCat = new Map(products.map((p) => [p.id, p.category_id]));
    const share = new Map();
    items.forEach((i) => {
      const name = catName.get(prodCat.get(i.product_id)) || "Uncategorized";
      share.set(name, (share.get(name) || 0) + n(i.line_total));
    });
    const shareArr = [...share.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).filter((x) => x.value > 0);
    return { revenue, gross, net: gross - expTotal, expTotal, dues, payables, invValue, invRetail, lowStock, products, sales, items, deltaSales: delta(revenue, revPrev), trend: days, share: shareArr, customers: custQ.rows.length, suppliers: suppQ.rows.filter((s) => s.is_active !== false).length };
  }, [salesQ.rows, itemsQ.rows, expQ.rows, prodQ.rows, custQ.rows, purchQ.rows, catQ.rows, suppQ.rows, preset, branchId]);

  return (
    <div className="page-in">
      <PageHeader title="Executive Business Dashboard" sub={<>Real-time multi-branch overview for <span className="font-semibold text-blue-600 dark:text-blue-400">{branch?.name || "All Branches"}</span></>}>
        <Select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-36">
          {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Link href="/pos"><Button><ShoppingCart className="h-4 w-4" /> Open POS Terminal</Button></Link>
      </PageHeader>
      <SchemaBanner error={error} />

      <div className="stagger-in grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard compact label="Total Sales" value={money(d.revenue)} sub={`${d.sales.length} invoice${d.sales.length === 1 ? "" : "s"}`} icon={CircleDollarSign} tone="indigo" delta={preset === "all" ? null : d.deltaSales} />
        <StatCard compact label="Gross Profit" value={money(d.gross)} sub="Revenue − COGS" icon={TrendingUp} tone="emerald" />
        <StatCard compact label="Net Profit" value={money(d.net)} sub="After expenses" icon={Landmark} tone={d.net >= 0 ? "emerald" : "red"} />
        <StatCard compact label="Total Expenses" value={money(d.expTotal)} sub="Operating overhead" icon={TrendingDown} tone="amber" />
        <StatCard compact label="Customer Dues" value={money(d.dues)} sub="Accounts receivable" icon={CreditCard} tone="cyan" />
        <StatCard compact label="Supplier Payables" value={money(d.payables)} sub="Accounts payable" icon={Wallet} tone="violet" />
      </div>

      <div className="stagger-in mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Products" value={String(d.products.length)} sub="In active catalog" icon={Package} tone="indigo" />
        <StatCard label="Low Stock Alert" value={String(d.lowStock.length)} sub="Re-order required" icon={AlertTriangle} tone={d.lowStock.length ? "red" : "slate"} />
        <StatCard label="Inventory Value (Cost)" value={money(d.invValue)} sub={`Retail: ${money(d.invRetail)}`} icon={Boxes} tone="cyan" />
        <StatCard label="Customer Base" value={String(d.customers)} sub={`${d.suppliers} active suppliers`} icon={Users} tone="violet" />
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales & Purchase Activity Trend" sub="Transaction volume distribution across time intervals" />
          <div className="p-4">
            {loading ? <div className="skeleton h-[230px] w-full" /> : d.trend.every((t) => t.sales === 0) ? <EmptyState icon={Receipt} title="No sales in this period" sub="Sales you complete in POS will chart here automatically." /> : <SalesAreaChart data={d.trend} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Category Revenue Share" sub="Contribution by merchandise group" />
          <div className="p-4">
            {loading ? <div className="skeleton h-[230px] w-full" /> : d.share.length === 0 ? <EmptyState title="No category data yet" sub="Category share is computed from sold items." /> : <CategoryDonut data={d.share} />}
          </div>
        </Card>
      </div>

      <Card className="mt-3.5">
        <CardHeader title="Recent Sales & Checkout Invoices" sub="Live synchronized sales records across terminals" action={<Link href="/sales" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">View All Sales <ArrowRight className="h-3.5 w-3.5" /></Link>} />
        {loading ? <div className="skeleton m-4 h-36" /> : d.sales.length === 0 ? <EmptyState icon={Receipt} title="No invoices yet" sub="Your first POS sale will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60">{["Invoice No", "Date & Time", "Items", "Payment", "Status", "Total Amount"].map((h, i) => <th key={h} className={`px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i === 5 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {salesQ.rows.slice(0, 5).map((s) => (
                  <tr key={s.id} className="transition hover:bg-blue-50/35 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400"><Link href={`/sales/${s.id}`}>{s.invoice_no}</Link></td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtDate(s.created_at, true)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{itemsQ.rows.filter((i) => i.sale_id === s.id).length} line(s)</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.payment_method}</td>
                    <td className="px-4 py-2.5">{statusBadge(s.status)}</td>
                    <td className="tnum px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.lowStock.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <p className="flex-1"><strong>Low stock:</strong> {d.lowStock.map((p) => `${p.name} (${n(p.stock)} left)`).join(", ")}</p>
          <Link href="/inventory"><Button size="sm" variant="secondary">Review inventory</Button></Link>
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 text-[12px] text-slate-400"><Users className="h-3.5 w-3.5" /> All figures on this page are computed live from your database — nothing is hardcoded.</div>
    </div>
  );
}
