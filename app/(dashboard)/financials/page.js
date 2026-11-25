"use client";
import { useMemo, useState } from "react";
import { Banknote, CircleDollarSign, Download, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { useTable } from "@/lib/data";
import { downloadCSV, fmtDate, money, n } from "@/lib/utils";
import { Card, CardHeader, DataTable, PageHeader, SchemaBanner, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function FinancialsPage() {
  const [tab, setTab] = useState("pl");
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const itemsQ = useTable("sale_items");
  const expQ = useTable("expenses", (q) => q.order("expense_date", { ascending: false }));

  const f = useMemo(() => {
    const revenue = salesQ.rows.reduce((a, s) => a + n(s.total), 0);
    const tax = salesQ.rows.reduce((a, s) => a + n(s.tax_amount), 0);
    const cogs = itemsQ.rows.reduce((a, i) => a + n(i.cost) * n(i.qty), 0);
    const gross = revenue - tax - cogs;
    const expTotal = expQ.rows.reduce((a, e) => a + n(e.amount), 0);
    const byMethod = new Map();
    salesQ.rows.forEach((s) => byMethod.set(s.payment_method, (byMethod.get(s.payment_method) || 0) + n(s.amount_paid)));
    const received = salesQ.rows.reduce((a, s) => a + n(s.amount_paid), 0);
    const cashSales = byMethod.get("Cash") || 0;
    const cashExpenses = expQ.rows.filter((e) => (e.payment_method || "Cash") === "Cash").reduce((a, e) => a + n(e.amount), 0);
    const txns = [
      ...salesQ.rows.map((s) => ({ id: "s" + s.id, date: s.created_at, label: `Sale ${s.invoice_no}`, method: s.payment_method, amount: n(s.amount_paid), kind: "in" })),
      ...expQ.rows.map((e) => ({ id: "e" + e.id, date: e.expense_date || e.created_at, label: `Expense — ${e.description}`, method: e.payment_method || "Cash", amount: -n(e.amount), kind: "out" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return { revenue, tax, cogs, gross, expTotal, net: gross - expTotal, byMethod: [...byMethod.entries()], received, cashSales, cashExpenses, drawer: cashSales - cashExpenses, txns };
  }, [salesQ.rows, itemsQ.rows, expQ.rows]);

  const loading = salesQ.loading || expQ.loading;
  function exportCsv() {
    downloadCSV("financials.csv", [["Metric", "Amount"], ["Total Revenue", f.revenue.toFixed(2)], ["Tax Collected", f.tax.toFixed(2)], ["COGS", f.cogs.toFixed(2)], ["Gross Profit", f.gross.toFixed(2)], ["Total Expenses", f.expTotal.toFixed(2)], ["Net Profit", f.net.toFixed(2)]]);
  }
  const Row = ({ label, value, bold, negative }) => (
    <div className={cn("flex items-center justify-between py-2.5", bold && "border-t border-dashed border-slate-200 pt-3.5 dark:border-slate-700")}>
      <span className={cn("text-sm", bold ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500")}>{label}</span>
      <span className={cn("tnum text-sm", bold ? "text-base font-bold text-slate-900 dark:text-white" : "font-medium text-slate-800 dark:text-slate-100", negative && "text-red-500")}>{money(value)}</span>
    </div>
  );

  return (
    <div className="page-in">
      <PageHeader title="Financial Overview" sub="Profit & loss, cash flow and register management — every figure computed from live data">
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Download className="h-4 w-4" /> Export CSV</button>
      </PageHeader>
      <SchemaBanner error={salesQ.error || expQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={money(f.revenue)} sub="All sales, tax included" icon={CircleDollarSign} tone="indigo" />
        <StatCard label="Gross Profit" value={money(f.gross)} sub="Revenue − tax − COGS" icon={TrendingUp} tone="emerald" />
        <StatCard label="Total Expenses" value={money(f.expTotal)} sub="Operating overhead" icon={TrendingDown} tone="amber" />
        <StatCard label="Net Profit" value={money(f.net)} sub="After expenses" icon={Landmark} tone={f.net >= 0 ? "emerald" : "red"} />
      </div>
      <div className="mb-5 flex gap-2">
        {[["pl", "Profit & Loss"], ["txns", "Transactions"]].map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition", tab === v ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700")}>{l}</button>)}
      </div>
      {tab === "pl" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Profit & Loss Statement" sub="Derived entirely from sales, sale items and expenses" />
            <div className="px-6 py-4">
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Revenue</p>
              <Row label="Total Sales (incl. tax)" value={f.revenue} />
              <Row label="Less: Tax Collected" value={-f.tax} />
              <p className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cost of Goods Sold</p>
              <Row label="COGS (from items sold)" value={-f.cogs} />
              <Row label="Gross Profit" value={f.gross} bold />
              <p className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operating Expenses</p>
              <Row label="Total Expenses" value={-f.expTotal} />
              <Row label="Net Profit" value={f.net} bold negative={f.net < 0} />
            </div>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Payment Method Breakdown" sub="Amount actually received" />
              <div className="px-6 py-4">
                {f.byMethod.length === 0 ? <p className="py-3 text-sm text-slate-400">No payments received yet.</p> : f.byMethod.map(([m, v]) => <Row key={m} label={m} value={v} />)}
                <Row label="Total Received" value={f.received} bold />
              </div>
            </Card>
            <Card>
              <CardHeader title="Cash Drawer" sub="Expected cash on hand" />
              <div className="px-6 py-4">
                <Row label="Cash Sales" value={f.cashSales} />
                <Row label="Cash Expenses" value={-f.cashExpenses} />
                <Row label="Expected Balance" value={f.drawer} bold />
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400"><Banknote className="h-3.5 w-3.5" /> Computed live — count the drawer against this figure at close.</p>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <DataTable rows={f.txns} loading={loading} pageSize={12} columns={[
            { label: "Date", render: (t) => <span className="text-slate-500">{fmtDate(t.date, true)}</span> },
            { label: "Description", render: (t) => <span className="font-medium text-slate-800 dark:text-slate-100">{t.label}</span> },
            { label: "Method", render: (t) => t.method },
            { label: "Amount", align: "right", render: (t) => <span className={t.kind === "in" ? "text-emerald-600" : "text-red-500"}>{t.kind === "in" ? "+" : "−"}{money(Math.abs(t.amount)).slice(0)}</span> },
          ]} />
        </Card>
      )}
    </div>
  );
}
