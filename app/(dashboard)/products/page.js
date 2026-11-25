"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Package, Pencil, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { money, n } from "@/lib/utils";
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, StatCard, Textarea, useToast } from "@/components/ui";
import QuickAddSelect from "@/components/QuickAddSelect";

export default function ProductsPage() {
  const toast = useToast();
  const prodQ = useTable("products", (q) => q.order("created_at", { ascending: false }));
  const catQ = useTable("categories", (q) => q.order("name"));
  const brandQ = useTable("brands", (q) => q.order("name"));
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", sku: "", category_id: "", brand_id: "", price: "", cost: "", stock: "", low_stock_at: 5, description: "", image_url: "" });
  const [saving, setSaving] = useState(false);

  const catName = useMemo(() => new Map(catQ.rows.map((c) => [c.id, c.name])), [catQ.rows]);
  const brandName = useMemo(() => new Map(brandQ.rows.map((b) => [b.id, b.name])), [brandQ.rows]);
  const rows = prodQ.rows.filter((p) => (cat === "all" || p.category_id === cat) && (p.name + " " + (p.sku || "")).toLowerCase().includes(search.toLowerCase()));
  const stockValue = prodQ.rows.reduce((a, p) => a + n(p.stock) * n(p.cost), 0);
  const lowCount = prodQ.rows.filter((p) => n(p.stock) <= n(p.low_stock_at)).length;
  const margins = prodQ.rows.filter((p) => n(p.price) > 0).map((p) => ((n(p.price) - n(p.cost)) / n(p.price)) * 100);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

  function openAdd() { setEditing(null); setForm({ name: "", sku: "", category_id: "", brand_id: "", price: "", cost: "", stock: "", low_stock_at: 5, description: "", image_url: "" }); setOpen(true); }
  function openEdit(p) { setEditing(p); setForm({ name: p.name, sku: p.sku, category_id: p.category_id || "", brand_id: p.brand_id || "", price: p.price, cost: p.cost, stock: p.stock, low_stock_at: p.low_stock_at, description: p.description || "", image_url: p.image_url || "" }); setOpen(true); }

  async function save(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured.", "error");
    setSaving(true);
    const values = { name: form.name, sku: form.sku, category_id: form.category_id || null, brand_id: form.brand_id || null, price: n(form.price), cost: n(form.cost), stock: n(form.stock), low_stock_at: n(form.low_stock_at), description: form.description || null, image_url: form.image_url || null };
    const { data, error } = editing ? await sb.from("products").update(values).eq("id", editing.id).select().single() : await sb.from("products").insert(values).select().single();
    setSaving(false);
    if (error) return toast(error.message, "error");
    if (!editing && n(form.stock) > 0) await sb.from("stock_movements").insert({ product_id: data.id, type: "Opening Stock", qty: n(form.stock), ref: data.sku });
    await logAudit(editing ? "Update" : "Create", `Product: ${data.name} (${data.sku})`);
    toast(`Product ${editing ? "updated" : "saved"}.`); setOpen(false); prodQ.reload();
  }
  async function remove(p) {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    const sb = supabase(); if (!sb) return;
    const { error } = await sb.from("products").delete().eq("id", p.id);
    if (error) return toast(error.message, "error");
    await logAudit("Delete", `Product: ${p.name}`); toast("Product deleted."); prodQ.reload();
  }
  const statusOf = (p) => n(p.stock) <= 0 ? <Badge tone="red">Out of Stock</Badge> : n(p.stock) <= n(p.low_stock_at) ? <Badge tone="red">Low Stock</Badge> : <Badge tone="green">In Stock</Badge>;

  return (
    <div className="page-in">
      <PageHeader title="Products" sub="Manage your product catalog and pricing">
        <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-9" /></div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full sm:w-44"><option value="all">All Categories</option>{catQ.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Button onClick={openAdd} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Add New Product</Button>
      </PageHeader>
      <SchemaBanner error={prodQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Products" value={String(prodQ.rows.length)} sub="In active catalog" icon={Package} tone="indigo" />
        <StatCard label="Stock Value (Cost)" value={money(stockValue)} sub="Computed: Σ stock × cost" icon={Boxes} tone="sky" />
        <StatCard label="Low Stock Items" value={String(lowCount)} sub="At or below reorder level" icon={AlertTriangle} tone={lowCount ? "red" : "slate"} />
        <StatCard label="Average Margin" value={avgMargin.toFixed(1) + "%"} sub="Computed from price & cost" icon={TrendingUp} tone="emerald" />
      </div>
      <Card>
        <DataTable rows={rows} loading={prodQ.loading} columns={[
          { label: "Product", render: (p) => (<div className="flex items-center gap-3">{p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-400 dark:bg-indigo-500/10">{p.name.charAt(0)}</span>}<div><p className="font-medium text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-xs text-slate-400">{brandName.get(p.brand_id) || ""}</p></div></div>) },
          { label: "SKU", render: (p) => <span className="font-mono text-[13px]">{p.sku}</span> },
          { label: "Category", render: (p) => catName.get(p.category_id) || "—" },
          { label: "Price", align: "right", render: (p) => money(p.price) },
          { label: "Cost", align: "right", render: (p) => money(p.cost) },
          { label: "Stock", align: "center", render: (p) => n(p.stock) },
          { label: "Margin", align: "right", render: (p) => n(p.price) > 0 ? (((n(p.price) - n(p.cost)) / n(p.price)) * 100).toFixed(0) + "%" : "—" },
          { label: "Status", render: (p) => statusOf(p) },
          { label: "Actions", align: "right", render: (p) => (<div className="flex justify-end gap-1"><button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800" aria-label="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>) },
        ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Product" : "Add New Product"} sub="Product details for your catalog." wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Earbuds" required /></Field>
          <Field label="SKU" required><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. EL-001" required /></Field>
          <QuickAddSelect
            label="Category"
            value={form.category_id}
            onChange={(v) => setForm({ ...form, category_id: v })}
            placeholder="Select category…"
            options={catQ.rows.map((c) => ({ value: c.id, label: c.name }))}
            entityLabel="Category"
            table="categories"
            onCreated={() => catQ.reload()}
          />
          <QuickAddSelect
            label="Brand"
            value={form.brand_id}
            onChange={(v) => setForm({ ...form, brand_id: v })}
            placeholder="Select brand…"
            options={brandQ.rows.map((b) => ({ value: b.id, label: b.name }))}
            entityLabel="Brand"
            table="brands"
            onCreated={() => brandQ.reload()}
          />
          <Field label="Sale Price (PKR)" required><Input type="number" step="any" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" required /></Field>
          <Field label="Cost Price (PKR)"><Input type="number" step="any" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></Field>
          <Field label="Stock Quantity"><Input type="number" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" /></Field>
          <Field label="Low Stock Alert At"><Input type="number" step="any" value={form.low_stock_at} onChange={(e) => setForm({ ...form, low_stock_at: e.target.value })} placeholder="5" /></Field>
          <Field label="Image URL (optional)" className="sm:col-span-2"><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product description…" /></Field>
          <div className="flex justify-end gap-2 pt-1 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Save Product"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
