"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Download, History, PackageX, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { downloadCSV, fmtDate, money, n } from "@/lib/utils";
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, StatCard, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

const TABS = [["levels", "Stock Levels"], ["low", "Low Stock Alerts"], ["movements", "Movement Audit"]];

export default function InventoryPage() {
  const toast = useToast();
  const [tab, setTab] = useState("levels");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const prodQ = useTable("products", (q) => q.order("name"));
  const movQ = useTable("stock_movements", (q) => q.order("created_at", { ascending: false }).limit(200));
  const [adjust, setAdjust] = useState(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const low = prodQ.rows.filter((p) => n(p.stock) <= n(p.low_stock_at) && n(p.stock) > 0);
  const out = prodQ.rows.filter((p) => n(p.stock) <= 0);
  const totalValue = prodQ.rows.reduce((a, p) => a + n(p.stock) * n(p.cost), 0);
  const prodName = useMemo(() => new Map(prodQ.rows.map((p) => [p.id, p.name])), [prodQ.rows]);

  const levelRows = prodQ.rows.filter((p) => {
    if (tab === "low") return n(p.stock) <= n(p.low_stock_at);
    if (filter === "low") return n(p.stock) <= n(p.low_stock_at) && n(p.stock) > 0;
    if (filter === "out") return n(p.stock) <= 0;
    return true;
  }).filter((p) => (p.name + p.sku).toLowerCase().includes(search.toLowerCase()));

  async function saveAdjust(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured.", "error");
    const d = n(delta);
    if (!d) return toast("Enter a non-zero adjustment quantity.", "warn");
    setSaving(true);
    const newStock = n(adjust.stock) + d;
    const { error } = await sb.from("products").update({ stock: newStock }).eq("id", adjust.id);
    if (error) { setSaving(false); return toast(error.message, "error"); }
    await sb.from("stock_movements").insert({ product_id: adjust.id, type: "Adjustment", qty: d, ref: adjust.sku, note: note || null });
    await logAudit("Stock Adjustment", `${adjust.name}: ${n(adjust.stock)} → ${newStock} (${d > 0 ? "+" : ""}${d})`);
    setSaving(false); setAdjust(null); setDelta(""); setNote("");
    toast(`Stock adjusted for ${adjust.name}.`); prodQ.reload(); movQ.reload();
  }

  function exportCsv() {
    downloadCSV("inventory.csv", [["Product", "SKU", "Stock", "Low Stock At", "Unit Cost", "Stock Value"], ...prodQ.rows.map((p) => [p.name, p.sku, n(p.stock), n(p.low_stock_at), n(p.cost).toFixed(2), (n(p.stock) * n(p.cost)).toFixed(2)])]);
  }

  return (
    <div className="page-in">
      <PageHeader title="Stock & Inventory" sub="Monitor stock levels, valuations and low-stock alerts">
        <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </PageHeader>
      <SchemaBanner error={prodQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Items" value={String(prodQ.rows.length)} sub="Products tracked" icon={Boxes} tone="indigo" />
        <StatCard label="Total Stock Value" value={money(totalValue)} sub="Computed: Σ stock × cost" icon={Boxes} tone="sky" />
        <StatCard label="Low Stock" value={String(low.length)} sub="At or below reorder level" icon={AlertTriangle} tone={low.length ? "amber" : "slate"} />
        <StatCard label="Out of Stock" value={String(out.length)} sub="Needs immediate reorder" icon={PackageX} tone={out.length ? "red" : "slate"} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {TABS.map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition", tab === v ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700")}>{l}{v === "low" ? ` (${low.length + out.length})` : v === "movements" ? ` (${movQ.rows.length})` : ""}</button>)}
        </div>
        {tab !== "movements" && <>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name or SKU…" className="w-64" />
          {tab === "levels" && <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44"><option value="all">All Items</option><option value="low">Low Stock Only</option><option value="out">Out of Stock</option></Select>}
        </>}
      </div>
      <Card>
        {tab === "movements" ? (
          <DataTable rows={movQ.rows} loading={movQ.loading} columns={[
            { label: "Date", render: (m) => <span className="text-slate-500">{fmtDate(m.created_at, true)}</span> },
            { label: "Product", render: (m) => prodName.get(m.product_id) || "—" },
            { label: "Type", render: (m) => <Badge tone={m.type === "Sale" ? "indigo" : m.type === "Adjustment" ? "amber" : m.type === "Purchase" ? "green" : "slate"}>{m.type}</Badge> },
            { label: "Qty", align: "right", render: (m) => <span className={n(m.qty) < 0 ? "text-red-500" : "text-emerald-600"}>{n(m.qty) > 0 ? "+" : ""}{n(m.qty)}</span> },
            { label: "Reference", render: (m) => m.ref || "—" },
            { label: "Note", render: (m) => m.note || "—" },
          ]} />
        ) : (
          <DataTable rows={levelRows} loading={prodQ.loading} columns={[
            { label: "Product", render: (p) => <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span> },
            { label: "SKU", render: (p) => <span className="font-mono text-[13px]">{p.sku}</span> },
            { label: "Current Stock", align: "center", render: (p) => `${n(p.stock)} units` },
            { label: "Low Stock At", align: "center", render: (p) => n(p.low_stock_at) },
            { label: "Stock Value", align: "right", render: (p) => money(n(p.stock) * n(p.cost)) },
            { label: "Status", render: (p) => n(p.stock) <= 0 ? <Badge tone="red">Out of Stock</Badge> : n(p.stock) <= n(p.low_stock_at) ? <Badge tone="amber">Low Stock</Badge> : <Badge tone="green">In Stock</Badge> },
            { label: "Actions", align: "right", render: (p) => <Button size="sm" variant="secondary" onClick={() => setAdjust(p)}><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Stock</Button> },
          ]} />
        )}
      </Card>
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title="Adjust Stock" sub={adjust ? `${adjust.name} — current stock ${n(adjust.stock)} units` : ""}>
        <form onSubmit={saveAdjust} className="space-y-4">
          <Field label="Adjustment Quantity (+ adds, − removes)" required><Input type="number" step="any" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 10 or -3" required autoFocus /></Field>
          <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment…" /></Field>
          {adjust && delta !== "" && <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-500 dark:bg-slate-800">New stock will be <strong className="text-slate-800 dark:text-slate-100">{n(adjust.stock) + n(delta)} units</strong>. This is recorded in the movement audit.</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAdjust(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Adjustment"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
