"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useTable } from "@/lib/data";
import { downloadCSV, money, n } from "@/lib/utils";
import { Button, Card, DataTable, PageHeader, SchemaBanner, Select, StatCard } from "@/components/ui";
import { CircleDollarSign, FileText, TrendingUp, Landmark } from "lucide-react";
import { SalesAreaChart } from "@/components/Charts";
import { cn } from "@/lib/cn";

const TABS = ["Sales Overview", "Product Volume", "Profit & Loss", "Receivables", "Payables", "Stock Valuation", "Expenses"];

export default function ReportsPage() {
  const [tab, setTab] = useState("Sales Overview");
  const [preset, setPreset] = useState("30d");
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const itemsQ = useTable("sale_items");
  const prodQ = useTable("products");
  const custQ = useTable("customers");
  const supQ = useTable("suppliers");
  const poQ = useTable("purchases");
  const expQ = useTable("expenses");

  const r = useMemo(() => {
    const days = preset === "7d" ? 7 : preset === "month" ? 30 : preset === "all" ? 36500 : 30;
    const cutoff = Date.now() - days * 86400000;
    const sales = salesQ.rows.filter((s) => new Date(s.created_at).getTime() >= cutoff);
    const saleIds = new Set(sales.map((s) => s.id));
    const items = itemsQ.rows.filter((i) => saleIds.has(i.sale_id));
    const revenue = sales.reduce((a, s) => a + n(s.total), 0);
    const tax = sales.reduce((a, s) => a + n(s.tax_amount), 0);
    const cogs = items.reduce((a, i) => a + n(i.cost) * n(i.qty), 0);
    const gross = revenue - tax - cogs;
    const exps = expQ.rows.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= cutoff);
    const expTotal = exps.reduce((a, e) => a + n(e.amount), 0);
    // product volume (revenue ex-tax = price x qty)
    const pv = new Map();
    items.forEach((i) => { const cur = pv.get(i.product_name) || { name: i.product_name, sku: "", units: 0, revenue: 0 }; cur.units += n(i.qty); cur.revenue += n(i.price) * n(i.qty); pv.set(i.product_name, cur); });
    const prodSku = new Map(prodQ.rows.map((p) => [p.name, p.sku]));
    const productVolume = [...pv.values()].map((x) => ({ ...x, sku: prodSku.get(x.name) || "—", avg: x.units ? x.revenue / x.units : 0 })).sort((a, b) => b.revenue - a.revenue);
    // receivables / payables (all time)
    const recv = new Map(); salesQ.rows.forEach((s) => { if (!s.customer_id) return; const c = recv.get(s.customer_id) || { purchases: 0, paid: 0 }; c.purchases += n(s.total); c.paid += n(s.amount_paid); recv.set(s.customer_id, c); });
    const pay = new Map(); poQ.rows.forEach((p) => { if (!p.supplier_id) return; const c = pay.get(p.supplier_id) || { purchases: 0, paid: 0 }; c.purchases += n(p.total); c.paid += n(p.amount_paid); pay.set(p.supplier_id, c); });
    const custName = new Map(custQ.rows.map((c) => [c.id, c.name])); const supName = new Map(supQ.rows.map((s) => [s.id, s.name]));
    const receivables = [...recv.entries()].map(([id, v]) => ({ id, name: custName.get(id) || "—", ...v, due: v.purchases - v.paid }));
    const payables = [...pay.entries()].map(([id, v]) => ({ id, name: supName.get(id) || "—", ...v, due: v.purchases - v.paid }));
    // expenses by category
    const ec = new Map(); exps.forEach((e) => { const c = ec.get(e.category) || { amount: 0, count: 0 }; c.amount += n(e.amount); c.count += 1; ec.set(e.category, c); });
    const expByCat = [...ec.entries()].map(([category, v]) => ({ category, ...v }));
    // trend
    const trendDays = Math.min(14, days);
    const trend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const ds = new Date(); ds.setHours(0, 0, 0, 0); ds.setDate(ds.getDate() - i);
      const de = new Date(ds.getTime() + 86400000);
      trend.push({ day: ds.toLocaleDateString("en-US", { month: "short", day: "numeric" }), sales: Math.round(sales.filter((s) => { const t = new Date(s.created_at); return t >= ds && t < de; }).reduce((a, s) => a + n(s.total), 0) * 100) / 100 });
    }
    const byMethod = new Map(); sales.forEach((s) => byMethod.set(s.payment_method, (byMethod.get(s.payment_method) || 0) + n(s.total)));
    return { sales, revenue, tax, cogs, gross, expTotal, net: gross - expTotal, productVolume, receivables, payables, expByCat, trend, byMethod: [...byMethod.entries()], margin: revenue - tax > 0 ? ((gross - expTotal) / (revenue - tax)) * 100 : 0 };
  }, [salesQ.rows, itemsQ.rows, expQ.rows, poQ.rows, custQ.rows, supQ.rows, prodQ.rows, preset]);

  function exportCsv() {
    if (tab === "Product Volume") downloadCSV("product-volume.csv", [["Product", "SKU", "Units Sold", "Revenue", "Avg Price"], ...r.productVolume.map((x) => [x.name, x.sku, x.units, x.revenue.toFixed(2), x.avg.toFixed(2)])]);
    else if (tab === "Stock Valuation") downloadCSV("stock-valuation.csv", [["Product", "SKU", "Stock", "Unit Cost", "Total Cost", "Retail Price", "Total Retail"], ...prodQ.rows.map((p) => [p.name, p.sku, n(p.stock), n(p.cost).toFixed(2), (n(p.stock) * n(p.cost)).toFixed(2), n(p.price).toFixed(2), (n(p.stock) * n(p.price)).toFixed(2)])]);
    else if (tab === "Receivables") downloadCSV("receivables.csv", [["Customer", "Total Purchases", "Total Paid", "Outstanding"], ...r.receivables.map((x) => [x.name, x.purchases.toFixed(2), x.paid.toFixed(2), x.due.toFixed(2)])]);
    else if (tab === "Payables") downloadCSV("payables.csv", [["Supplier", "Total Purchases", "Total Paid", "Outstanding"], ...r.payables.map((x) => [x.name, x.purchases.toFixed(2), x.paid.toFixed(2), x.due.toFixed(2)])]);
    else if (tab === "Expenses") downloadCSV("expenses-by-category.csv", [["Category", "Amount", "Count"], ...r.expByCat.map((x) => [x.category, x.amount.toFixed(2), x.count])]);
    else if (tab === "Profit & Loss") downloadCSV("profit-and-loss.csv", [["Metric", "Amount"], ["Total Revenue", r.revenue.toFixed(2)], ["Tax", r.tax.toFixed(2)], ["COGS", r.cogs.toFixed(2)], ["Gross Profit", r.gross.toFixed(2)], ["Operating Expenses", r.expTotal.toFixed(2)], ["Net Profit", r.net.toFixed(2)]]);
    else downloadCSV("sales-overview.csv", [["Metric", "Amount"], ["Total Sales", r.revenue.toFixed(2)], ["Invoices", r.sales.length], ["Gross Profit", r.gross.toFixed(2)], ["Net Profit", r.net.toFixed(2)], ...r.byMethod.map(([m, v]) => [`Sales via ${m}`, v.toFixed(2)])]);
  }

  const loading = salesQ.loading || itemsQ.loading;
  return (
    <div className="page-in">
      <PageHeader title="Reports & Analytics" sub="Business intelligence computed from the same live tables as the dashboard">
        <Select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-40"><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="month">This Month</option><option value="all">All Time</option></Select>
        <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </PageHeader>
      <SchemaBanner error={salesQ.error} />
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3.5 py-2 text-[13px] font-medium transition", tab === t ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700")}>{t}</button>)}
      </div>

      {tab === "Sales Overview" && <>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sales" value={money(r.revenue)} sub={`${r.sales.length} invoices`} icon={CircleDollarSign} tone="indigo" />
          <StatCard label="Total Invoices" value={String(r.sales.length)} sub="In selected range" icon={FileText} tone="sky" />
          <StatCard label="Gross Profit" value={money(r.gross)} sub="Revenue − tax − COGS" icon={TrendingUp} tone="emerald" />
          <StatCard label="Net Profit" value={money(r.net)} sub="After expenses" icon={Landmark} tone={r.net >= 0 ? "emerald" : "red"} />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold">Sales Trend</h3></div><div className="p-4"><SalesAreaChart data={r.trend} /></div></Card>
          <Card><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="text-sm font-semibold">Sales by Payment Method</h3></div>
            <div className="space-y-3 px-5 py-4">{r.byMethod.length === 0 ? <p className="text-sm text-slate-400">No sales in range.</p> : r.byMethod.map(([m, v]) => { const pct = r.revenue > 0 ? (v / r.revenue) * 100 : 0; return (<div key={m}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">{m}</span><span className="tnum font-medium">{money(v)} • {pct.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: pct + "%" }} /></div></div>); })}</div>
          </Card>
        </div>
      </>}

      {tab === "Product Volume" && <Card><DataTable rows={r.productVolume.map((x, i) => ({ ...x, id: i }))} loading={loading} columns={[
        { label: "Product", render: (x) => <span className="font-medium text-slate-800 dark:text-slate-100">{x.name}</span> },
        { label: "SKU", render: (x) => <span className="font-mono text-[13px]">{x.sku}</span> },
        { label: "Units Sold", align: "center", render: (x) => x.units },
        { label: "Revenue (ex-tax)", align: "right", render: (x) => money(x.revenue) },
        { label: "Avg Price", align: "right", render: (x) => money(x.avg) },
      ]} /></Card>}

      {tab === "Profit & Loss" && <Card><div className="mx-auto max-w-xl px-6 py-6">
        {[["Total Revenue (incl. tax)", r.revenue], ["Less: Tax Collected", -r.tax], ["COGS", -r.cogs], ["Gross Profit", r.gross], ["Operating Expenses", -r.expTotal], ["Net Profit", r.net]].map(([l, v], i) => (
          <div key={l} className={cn("flex justify-between py-2.5 text-sm", (i === 3 || i === 5) && "border-t border-dashed border-slate-200 font-bold dark:border-slate-700")}><span className="text-slate-500">{l}</span><span className="tnum font-semibold">{money(v)}</span></div>
        ))}
        <div className="flex justify-between py-2.5 text-sm"><span className="text-slate-500">Net Profit Margin (on net revenue)</span><span className="tnum font-semibold">{r.margin.toFixed(1)}%</span></div>
      </div></Card>}

      {tab === "Receivables" && <Card><DataTable rows={r.receivables} loading={loading} columns={[
        { label: "Customer", render: (x) => <span className="font-medium text-slate-800 dark:text-slate-100">{x.name}</span> },
        { label: "Total Purchases", align: "right", render: (x) => money(x.purchases) },
        { label: "Total Paid", align: "right", render: (x) => money(x.paid) },
        { label: "Outstanding", align: "right", render: (x) => money(Math.max(0, x.due)) },
      ]} /></Card>}

      {tab === "Payables" && <Card><DataTable rows={r.payables} loading={loading} columns={[
        { label: "Supplier", render: (x) => <span className="font-medium text-slate-800 dark:text-slate-100">{x.name}</span> },
        { label: "Total Purchases", align: "right", render: (x) => money(x.purchases) },
        { label: "Total Paid", align: "right", render: (x) => money(x.paid) },
        { label: "Outstanding", align: "right", render: (x) => money(Math.max(0, x.due)) },
      ]} /></Card>}

      {tab === "Stock Valuation" && <Card><DataTable rows={prodQ.rows} loading={prodQ.loading} columns={[
        { label: "Product", render: (p) => <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span> },
        { label: "SKU", render: (p) => <span className="font-mono text-[13px]">{p.sku}</span> },
        { label: "Stock", align: "center", render: (p) => n(p.stock) },
        { label: "Unit Cost", align: "right", render: (p) => money(p.cost) },
        { label: "Total Cost", align: "right", render: (p) => money(n(p.stock) * n(p.cost)) },
        { label: "Retail Price", align: "right", render: (p) => money(p.price) },
        { label: "Total Retail", align: "right", render: (p) => money(n(p.stock) * n(p.price)) },
      ]} />
        <p className="border-t border-slate-100 px-4 py-3 text-right text-sm font-semibold dark:border-slate-800">Total cost value: {money(prodQ.rows.reduce((a, p) => a + n(p.stock) * n(p.cost), 0))} — computed as stock × unit cost for every row.</p>
      </Card>}

      {tab === "Expenses" && <Card><DataTable rows={r.expByCat.map((x, i) => ({ ...x, id: i }))} loading={expQ.loading} columns={[
        { label: "Category", render: (x) => <span className="font-medium text-slate-800 dark:text-slate-100">{x.category}</span> },
        { label: "Expenses", align: "center", render: (x) => x.count },
        { label: "Amount", align: "right", render: (x) => money(x.amount) },
      ]} /></Card>}
    </div>
  );
}
