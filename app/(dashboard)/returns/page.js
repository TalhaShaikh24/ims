"use client";
import { useMemo, useState } from "react";
import { CircleDollarSign, Plus, RotateCcw, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { docNo, fmtDate, money, n } from "@/lib/utils";
import { Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, StatCard, statusBadge, Textarea, useToast } from "@/components/ui";

export default function ReturnsPage() {
  const toast = useToast();
  const retQ = useTable("sales_returns", (q) => q.order("created_at", { ascending: false }));
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const custQ = useTable("customers");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("Damaged product");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const custName = useMemo(() => new Map(custQ.rows.map((c) => [c.id, c.name])), [custQ.rows]);
  const saleById = useMemo(() => new Map(salesQ.rows.map((s) => [s.id, s])), [salesQ.rows]);
  const rows = retQ.rows.filter((r) => !search || r.return_no.toLowerCase().includes(search.toLowerCase()) || (saleById.get(r.sale_id)?.invoice_no || "").toLowerCase().includes(search.toLowerCase()));
  const totalRefunds = rows.reduce((a, r) => a + n(r.amount), 0);
  const selectedSale = saleById.get(saleId);

  function pickSale(id) { setSaleId(id); const s = saleById.get(id); if (s) setAmount(String(n(s.total))); }

  async function submit(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured.", "error");
    const sale = saleById.get(saleId);
    if (!sale) return toast("Select an existing invoice first.", "error");
    setSaving(true);
    const return_no = docNo("RET");
    const { error } = await sb.from("sales_returns").insert({ return_no, sale_id: sale.id, customer_id: sale.customer_id, amount: n(amount), status: "Refunded", reason });
    if (error) { setSaving(false); return toast(error.message, "error"); }
    await sb.from("sales").update({ status: "Refunded" }).eq("id", sale.id);
    const { data: items } = await sb.from("sale_items").select("*").eq("sale_id", sale.id);
    for (const i of items || []) {
      if (!i.product_id) continue;
      const { data: p } = await sb.from("products").select("stock").eq("id", i.product_id).single();
      if (p) await sb.from("products").update({ stock: n(p.stock) + n(i.qty) }).eq("id", i.product_id);
      await sb.from("stock_movements").insert({ product_id: i.product_id, branch_id: sale.branch_id, type: "Sales Return", qty: n(i.qty), ref: return_no });
    }
    await logAudit("Sales Return", `${return_no} for ${sale.invoice_no} — ${money(amount)}`);
    setSaving(false); setOpen(false); setSaleId(""); setAmount("");
    toast(`Return ${return_no} processed and stock restored.`);
    retQ.reload();
  }

  return (
    <div className="page-in">
      <PageHeader title="Sales Returns" sub="Process product returns and issue refunds — always against a real invoice">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by return ID or invoice #…" className="w-full sm:w-64" />
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> New Sales Return</Button>
      </PageHeader>
      <SchemaBanner error={retQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Refunds" value={money(totalRefunds)} sub="In the current view" icon={CircleDollarSign} tone="red" />
        <StatCard label="Total Returns" value={String(rows.length)} sub="Processed returns" icon={Undo2} tone="amber" />
        <StatCard label="Pending Refunds" value={money(0)} sub="All returns settle immediately" icon={RotateCcw} tone="slate" />
      </div>
      <Card>
        <DataTable rows={rows} loading={retQ.loading} columns={[
          { label: "Return ID", render: (r) => <span className="font-bold text-[#4F46E5]">{r.return_no}</span> },
          { label: "Original Invoice", render: (r) => saleById.get(r.sale_id)?.invoice_no || "—" },
          { label: "Date", render: (r) => <span className="text-slate-500">{fmtDate(r.created_at, true)}</span> },
          { label: "Customer", render: (r) => custName.get(r.customer_id) || "Walk-in Customer" },
          { label: "Reason", render: (r) => r.reason || "—" },
          { label: "Status", render: (r) => statusBadge(r.status) },
          { label: "Amount", align: "right", render: (r) => money(r.amount) },
        ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Create Sales Return" sub="Only invoices that exist in Sales can be returned — stock is restored automatically.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Original Invoice" required>
            <Select value={saleId} onChange={(e) => pickSale(e.target.value)} required>
              <option value="">Select an invoice…</option>
              {salesQ.rows.map((s) => <option key={s.id} value={s.id}>{s.invoice_no} — {money(s.total)} — {fmtDate(s.created_at)}</option>)}
            </Select>
          </Field>
          {selectedSale && <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-500 dark:bg-slate-800">Invoice total {money(selectedSale.total)} • {selectedSale.payment_method} • {selectedSale.status}</p>}
          <Field label="Refund Amount ($)" required><Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}><option>Damaged product</option><option>Wrong item</option><option>Customer changed mind</option><option>Expired</option><option>Other</option></Select></Field>
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || !saleId}>{saving ? "Processing…" : "Submit Return"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
