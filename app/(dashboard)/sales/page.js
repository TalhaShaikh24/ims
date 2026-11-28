"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, Download, Eye, FileText, Percent, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { downloadCSV, fmtDate, money, n } from "@/lib/utils";
import { useBranch } from "@/components/Shell";
import { Button, Card, DataTable, Input, PageHeader, SchemaBanner, Select, StatCard, statusBadge, useToast } from "@/components/ui";

export default function SalesPage() {
  const toast = useToast();
  const { branchId } = useBranch();
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const itemsQ = useTable("sale_items");
  const custQ = useTable("customers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("new");

  const custName = useMemo(() => new Map(custQ.rows.map((c) => [c.id, c.name])), [custQ.rows]);
  const itemCount = useMemo(() => { const m = new Map(); itemsQ.rows.forEach((i) => m.set(i.sale_id, (m.get(i.sale_id) || 0) + n(i.qty))); return m; }, [itemsQ.rows]);

  const rows = useMemo(() => {
    let r = salesQ.rows.filter((s) => branchId === "all" || s.branch_id === branchId || s.branch_id == null);
    if (status !== "all") r = r.filter((s) => s.status === status);
    if (search) { const q = search.toLowerCase(); r = r.filter((s) => s.invoice_no.toLowerCase().includes(q) || (custName.get(s.customer_id) || "").toLowerCase().includes(q)); }
    if (sort === "old") r = [...r].reverse();
    if (sort === "high") r = [...r].sort((a, b) => n(b.total) - n(a.total));
    if (sort === "low") r = [...r].sort((a, b) => n(a.total) - n(b.total));
    return r;
  }, [salesQ.rows, branchId, status, search, sort, custName]);

  const revenue = rows.reduce((a, s) => a + n(s.total), 0);
  const discounts = rows.reduce((a, s) => a + n(s.discount), 0);

  function exportCsv() {
    downloadCSV("sales.csv", [["Invoice", "Date", "Customer", "Items", "Payment", "Status", "Total"], ...rows.map((s) => [s.invoice_no, fmtDate(s.created_at), custName.get(s.customer_id) || "Walk-in Customer", itemCount.get(s.id) || 0, s.payment_method, s.status, n(s.total).toFixed(2)])]);
  }

  async function remove(s) {
    if (!confirm(`Delete invoice ${s.invoice_no}? Sold stock will be restored automatically.`)) return;
    const sb = supabase(); if (!sb) return;
    const { data: items } = await sb.from("sale_items").select("*").eq("sale_id", s.id);
    for (const i of items || []) {
      if (!i.product_id) continue;
      const { data: p } = await sb.from("products").select("stock").eq("id", i.product_id).single();
      if (p) await sb.from("products").update({ stock: n(p.stock) + n(i.qty) }).eq("id", i.product_id);
      await sb.from("stock_movements").insert({ product_id: i.product_id, branch_id: s.branch_id, type: "Sale Void", qty: n(i.qty), ref: s.invoice_no });
    }
    await sb.from("sale_items").delete().eq("sale_id", s.id);
    const { error } = await sb.from("sales").delete().eq("id", s.id);
    if (error) return toast(error.message, "error");
    await logAudit("Delete", `Invoice voided & deleted: ${s.invoice_no}`);
    toast(`Invoice ${s.invoice_no} deleted and stock restored.`);
    salesQ.reload(); itemsQ.reload();
  }

  return (
    <div className="page-in">
      <PageHeader title="Sales Invoices" sub="View, print and manage customer invoices">
        <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
        <Link href="/pos"><Button><ShoppingCart className="h-4 w-4" /> New Sale</Button></Link>
      </PageHeader>
      <SchemaBanner error={salesQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={money(revenue)} sub="In the current view" icon={CircleDollarSign} tone="indigo" />
        <StatCard label="Total Invoices" value={String(rows.length)} sub="Processed sales" icon={FileText} tone="sky" />
        <StatCard label="Paid Invoices" value={String(rows.filter((s) => s.status === "Paid").length)} sub="Fully settled" icon={CircleDollarSign} tone="emerald" />
        <StatCard label="Total Discount" value={money(discounts)} sub="Discounts given" icon={Percent} tone="amber" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2.5 sm:gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice #, customer…" className="w-full sm:w-72" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[calc(50%-5px)] sm:w-40"><option value="all">All Status</option><option>Paid</option><option>Pending</option><option>Refunded</option></Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[calc(50%-5px)] sm:w-44"><option value="new">Newest First</option><option value="old">Oldest First</option><option value="high">Highest Amount</option><option value="low">Lowest Amount</option></Select>
      </div>
      <Card>
        <DataTable rows={rows} loading={salesQ.loading} columns={[
          { label: "Invoice", render: (s) => <Link href={`/sales/${s.id}`} className="font-bold text-[#4F46E5] hover:text-indigo-500">{s.invoice_no}</Link> },
          { label: "Date", render: (s) => <span className="text-slate-500">{fmtDate(s.created_at, true)}</span> },
          { label: "Customer", render: (s) => custName.get(s.customer_id) || "Walk-in Customer" },
          { label: "Items", align: "center", render: (s) => itemCount.get(s.id) || 0 },
          { label: "Payment", render: (s) => s.payment_method },
          { label: "Status", render: (s) => statusBadge(s.status) },
          { label: "Total", align: "right", render: (s) => money(s.total) },
          { label: "Actions", align: "right", render: (s) => (
            <div className="flex justify-end gap-1">
              <Link href={`/sales/${s.id}`} className="inline-flex rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800" aria-label="View invoice" title="View invoice"><Eye className="h-4 w-4" /></Link>
              <Link href={`/sales/${s.id}?print=1`} className="inline-flex rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Print invoice" title="Print invoice"><Printer className="h-4 w-4" /></Link>
              <button onClick={() => remove(s)} className="inline-flex rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800" aria-label="Delete invoice" title="Delete invoice"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) },
        ]} />
      </Card>
    </div>
  );
}
