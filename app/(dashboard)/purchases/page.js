"use client";
import { useMemo, useState } from "react";
import { CircleDollarSign, ClipboardList, PackageCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { docNo, fmtDate, money, n, round2 } from "@/lib/utils";
import { useBranch } from "@/components/Shell";
import { Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, StatCard, statusBadge, useToast } from "@/components/ui";
import QuickAddSelect from "@/components/QuickAddSelect";

export default function PurchasesPage() {
  const toast = useToast();
  const { branchId, branches } = useBranch();
  const poQ = useTable("purchases", (q) => q.order("created_at", { ascending: false }));
  const supQ = useTable("suppliers", (q) => q.order("name"));
  const prodQ = useTable("products", (q) => q.order("name"));
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ supplier_id: "", order_date: "", status: "Pending", amount_paid: "" });
  const [lines, setLines] = useState([]);
  const [pick, setPick] = useState({ product_id: "", qty: "", unit_cost: "" });
  const [saving, setSaving] = useState(false);

  const supName = useMemo(() => new Map(supQ.rows.map((s) => [s.id, s.name])), [supQ.rows]);
  const rows = poQ.rows.filter((p) => (statusF === "all" || p.status === statusF) && (p.po_no + (supName.get(p.supplier_id) || "")).toLowerCase().includes(search.toLowerCase()));
  const totalAmount = rows.reduce((a, p) => a + n(p.total), 0);
  const total = lines.reduce((a, l) => a + n(l.qty) * n(l.unit_cost), 0);

  function openAdd() { setEditing(null); setForm({ supplier_id: "", order_date: new Date().toISOString().slice(0, 10), status: "Pending", amount_paid: "" }); setLines([]); setOpen(true); }
  async function openEdit(p) {
    setEditing(p);
    setForm({ supplier_id: p.supplier_id || "", order_date: p.order_date || "", status: p.status, amount_paid: p.amount_paid });
    const sb = supabase();
    if (sb) { const { data } = await sb.from("purchase_items").select("*").eq("purchase_id", p.id); setLines((data || []).map((i) => ({ product_id: i.product_id, product_name: i.product_name, qty: n(i.qty), unit_cost: n(i.unit_cost) }))); }
    setOpen(true);
  }
  function addLine() {
    const prod = prodQ.rows.find((x) => x.id === pick.product_id);
    if (!prod || !n(pick.qty)) return toast("Select a product and quantity first.", "warn");
    setLines((l) => [...l, { product_id: prod.id, product_name: prod.name, qty: n(pick.qty), unit_cost: pick.unit_cost === "" ? n(prod.cost) : n(pick.unit_cost) }]);
    setPick({ product_id: "", qty: "", unit_cost: "" });
  }

  async function receiveStock(po, items) {
    const sb = supabase(); if (!sb) return;
    for (const i of items) {
      if (!i.product_id) continue;
      const { data: p } = await sb.from("products").select("stock").eq("id", i.product_id).single();
      if (p) await sb.from("products").update({ stock: n(p.stock) + n(i.qty) }).eq("id", i.product_id);
      await sb.from("stock_movements").insert({ product_id: i.product_id, branch_id: po.branch_id, type: "Purchase", qty: n(i.qty), ref: po.po_no });
    }
  }

  async function save(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured.", "error");
    if (!lines.length) return toast("Add at least one item to the order.", "warn");
    setSaving(true);
    const branch_id = branchId !== "all" ? branchId : (branches.find((b) => b.is_main)?.id || branches[0]?.id || null);
    const payload = { supplier_id: form.supplier_id || null, order_date: form.order_date || null, status: form.status, amount_paid: n(form.amount_paid), total: round2(total), branch_id: editing ? editing.branch_id : branch_id };
    let po = editing;
    if (editing) {
      const { data, error } = await sb.from("purchases").update(payload).eq("id", editing.id).select().single();
      if (error) { setSaving(false); return toast(error.message, "error"); }
      po = data;
      await sb.from("purchase_items").delete().eq("purchase_id", po.id);
    } else {
      const { data, error } = await sb.from("purchases").insert({ ...payload, po_no: docNo("PO") }).select().single();
      if (error) { setSaving(false); return toast(error.message, "error"); }
      po = data;
    }
    const items = lines.map((l) => ({ purchase_id: po.id, product_id: l.product_id, product_name: l.product_name, qty: n(l.qty), unit_cost: n(l.unit_cost), line_total: round2(n(l.qty) * n(l.unit_cost)) }));
    const { error: iErr } = await sb.from("purchase_items").insert(items);
    if (iErr) { setSaving(false); return toast(iErr.message, "error"); }
    const wasReceived = editing?.status === "Received";
    if (po.status === "Received" && !wasReceived) await receiveStock(po, items);
    await logAudit(editing ? "Update" : "Create", `Purchase Order: ${po.po_no} — ${money(po.total)}`);
    setSaving(false); setOpen(false); toast(`Purchase order ${po.po_no} saved.`); poQ.reload();
  }
  async function remove(p) {
    if (!confirm(`Delete purchase order ${p.po_no}?`)) return;
    const sb = supabase(); if (!sb) return;
    const { error } = await sb.from("purchases").delete().eq("id", p.id);
    if (error) return toast(error.message, "error");
    await logAudit("Delete", `Purchase Order: ${p.po_no}`); toast("Purchase order deleted."); poQ.reload();
  }

  return (
    <div className="page-in">
      <PageHeader title="Purchase Orders" sub="Manage supplier orders and goods receipts">
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by PO number, supplier…" className="w-full pl-9" /></div>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-full sm:w-40"><option value="all">All Status</option><option>Pending</option><option>Approved</option><option>Received</option><option>Cancelled</option></Select>
        <Button onClick={openAdd} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> New Purchase Order</Button>
      </PageHeader>
      <SchemaBanner error={poQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Purchases" value={money(totalAmount)} sub={`${rows.length} orders in view`} icon={CircleDollarSign} tone="indigo" />
        <StatCard label="Pending Orders" value={String(rows.filter((p) => p.status === "Pending").length)} sub="Awaiting approval" icon={ClipboardList} tone="amber" />
        <StatCard label="Received Orders" value={String(rows.filter((p) => p.status === "Received").length)} sub="Goods received into stock" icon={PackageCheck} tone="emerald" />
      </div>
      <Card>
        <DataTable rows={rows} loading={poQ.loading} columns={[
          { label: "PO Number", render: (p) => <span className="font-bold text-[#4F46E5]">{p.po_no}</span> },
          { label: "Date", render: (p) => <span className="text-slate-500">{fmtDate(p.order_date || p.created_at)}</span> },
          { label: "Supplier", render: (p) => supName.get(p.supplier_id) || "—" },
          { label: "Status", render: (p) => statusBadge(p.status) },
          { label: "Paid", align: "right", render: (p) => money(p.amount_paid) },
          { label: "Outstanding", align: "right", render: (p) => money(Math.max(0, n(p.total) - n(p.amount_paid))) },
          { label: "Total", align: "right", render: (p) => money(p.total) },
          { label: "Actions", align: "right", render: (p) => (<div className="flex justify-end gap-1"><button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>) },
        ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Purchase Order" : "New Purchase Order"} sub="Receiving an order adds its items into stock automatically." wide>
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QuickAddSelect
              label="Supplier"
              required
              value={form.supplier_id}
              onChange={(v) => setForm({ ...form, supplier_id: v })}
              placeholder="Select a supplier…"
              options={supQ.rows.map((s) => ({ value: s.id, label: s.name }))}
              entityLabel="Supplier"
              table="suppliers"
              onCreated={() => supQ.reload()}
            />
            <Field label="Order Date"><Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></Field>
            <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Pending</option><option>Approved</option><option>Received</option><option>Cancelled</option></Select></Field>
            <Field label="Amount Paid (PKR)"><Input type="number" step="any" min="0" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} placeholder="0.00" /></Field>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 text-sm font-semibold">Order Items</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_84px_104px_auto] sm:items-end">
              <QuickAddSelect
                label="Product"
                value={pick.product_id}
                onChange={(val) => { const p = prodQ.rows.find((x) => x.id === val); setPick({ ...pick, product_id: val, unit_cost: p ? String(n(p.cost)) : pick.unit_cost }); }}
                placeholder="Select a product…"
                options={prodQ.rows.map((p) => ({ value: p.id, label: p.name }))}
                entityLabel="Product"
                table="products"
                buildPayload={(name) => ({ name, sku: docNo("SKU"), price: 0, cost: 0, stock: 0, is_active: true })}
                onCreated={() => prodQ.reload()}
              />
              <Field label="Qty"><Input type="number" step="any" value={pick.qty} onChange={(e) => setPick({ ...pick, qty: e.target.value })} placeholder="0" /></Field>
              <Field label="Unit Cost"><Input type="number" step="any" value={pick.unit_cost} onChange={(e) => setPick({ ...pick, unit_cost: e.target.value })} placeholder="0.00" /></Field>
              <Button type="button" variant="secondary" onClick={addLine} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Add</Button>
            </div>
            {lines.length === 0 ? <p className="py-4 text-center text-[13px] text-slate-400">No items added yet. Select a product and click Add.</p> : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((l, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">{l.product_name}</span><span className="tnum text-slate-500">{n(l.qty)} × {money(l.unit_cost)}</span><span className="tnum font-semibold">{money(n(l.qty) * n(l.unit_cost))}</span><button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></li>)}
              </ul>
            )}
            <div className="mt-3 flex justify-between border-t border-dashed border-slate-200 pt-3 text-sm font-bold dark:border-slate-700"><span>Total Amount</span><span className="tnum">{money(total)}</span></div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Purchase Order"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
