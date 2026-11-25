"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Minus, Pause, Play, Plus, Search, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSetting, logAudit, useTable } from "@/lib/data";
import { docNo, money, n, round2 } from "@/lib/utils";
import { useBranch } from "@/components/Shell";
import { Button, Card, Field, Input, Modal, PageHeader, SchemaBanner, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function PosPage() {
  const router = useRouter();
  const toast = useToast();
  const { branchId, branches } = useBranch();
  const prodQ = useTable("products", (q) => q.eq("is_active", true).order("name"));
  const catQ = useTable("categories");
  const custQ = useTable("customers", (q) => q.order("name"));
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxRate, setTaxRate] = useState(8.5);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("Cash");
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState(null);

  useEffect(() => { getSetting("org", { tax_rate: 8.5 }).then((o) => setTaxRate(n(o?.tax_rate ?? 8.5))); try { const h = localStorage.getItem("xona_hold"); if (h) setHeld(JSON.parse(h)); } catch {} }, []);

  const products = useMemo(() => prodQ.rows.filter((p) => (cat === "all" || p.category_id === cat) && (p.name + " " + (p.sku || "")).toLowerCase().includes(search.toLowerCase())), [prodQ.rows, cat, search]);
  const catName = useMemo(() => new Map(catQ.rows.map((c) => [c.id, c.name])), [catQ.rows]);

  const subtotal = cart.reduce((a, i) => a + n(i.price) * i.qty, 0);
  const discount = round2(subtotal * (n(discountPct) / 100));
  const taxable = subtotal - discount;
  const tax = round2(taxable * (taxRate / 100));
  const total = round2(taxable + tax);
  const change = round2(n(received) - total);

  function add(p) {
    if (n(p.stock) <= 0) return toast(`${p.name} is out of stock.`, "warn");
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id);
      if (ex) return c.map((i) => i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, n(p.stock)) } : i);
      return [...c, { id: p.id, name: p.name, price: n(p.price), cost: n(p.cost), stock: n(p.stock), qty: 1 }];
    });
  }
  const setQty = (id, qty) => setCart((c) => qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => i.id === id ? { ...i, qty: Math.min(qty, i.stock) } : i));

  function hold() { localStorage.setItem("xona_hold", JSON.stringify(cart)); setHeld(cart); setCart([]); toast("Sale held — resume it any time."); }
  function resume() { if (held) { setCart(held); localStorage.removeItem("xona_hold"); setHeld(null); } }

  async function completeSale() {
    const sb = supabase(); if (!sb) return toast("Supabase is not configured — open the Setup page.", "error");
    if (method === "Cash" && received !== "" && n(received) < total) return toast("Cash received is less than the total due.", "error");
    setSaving(true);
    const branch_id = branchId !== "all" ? branchId : (branches.find((b) => b.is_main)?.id || branches[0]?.id || null);
    const invoice_no = docNo("INV");
    const { data: sale, error } = await sb.from("sales").insert({
      invoice_no, customer_id: customerId || null, branch_id, payment_method: method,
      status: "Paid", subtotal: round2(subtotal), discount, tax_rate: taxRate, tax_amount: tax, total, amount_paid: total,
      cashier_name: localStorage.getItem("xona_profile_name") || "Admin",
    }).select().single();
    if (error) { setSaving(false); return toast(error.message, "error"); }
    const items = cart.map((i) => ({ sale_id: sale.id, product_id: i.id, product_name: i.name, price: i.price, cost: i.cost, qty: i.qty, line_total: round2(i.price * i.qty) }));
    const { error: iErr } = await sb.from("sale_items").insert(items);
    if (iErr) { setSaving(false); return toast(iErr.message, "error"); }
    for (const i of cart) {
      const fresh = prodQ.rows.find((p) => p.id === i.id);
      await sb.from("products").update({ stock: n(fresh?.stock) - i.qty }).eq("id", i.id);
      await sb.from("stock_movements").insert({ product_id: i.id, branch_id, type: "Sale", qty: -i.qty, ref: invoice_no });
    }
    await logAudit("Sale", `${invoice_no} — ${money(total)} (${method})`);
    setSaving(false); setPayOpen(false); setCart([]);
    toast(`Sale ${invoice_no} completed.`);
    router.push(`/sales/${sale.id}`);
  }

  return (
    <div className="page-in">
      <PageHeader title="Point of Sale" sub="Fast checkout & receipt generation">
        <Button variant="secondary" onClick={hold} disabled={!cart.length}><Pause className="h-4 w-4" /> Hold{held ? ` (${held.length})` : ""}</Button>
        <Button variant="secondary" onClick={resume} disabled={!held}><Play className="h-4 w-4" /> Resume</Button>
      </PageHeader>
      <SchemaBanner error={prodQ.error} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_390px]">
        <div>
          <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="relative w-full sm:min-w-[220px] sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name or SKU…" className="w-full pl-9" />
            </div>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full sm:w-56">
              <option value="">Walk-in Customer</option>
              {custQ.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setCat("all")} className={cn("inline-flex h-8.5 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition", cat === "all" ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200")}>All ({prodQ.rows.length})</button>
            {catQ.rows.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cn("inline-flex h-8.5 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition", cat === c.id ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200")}>{c.name} ({prodQ.rows.filter((p) => p.category_id === c.id).length})</button>
            ))}
          </div>
          {prodQ.loading ? <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-44" />)}</div>
            : products.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">No products match. Add products from the Products page first.</Card>
            : (
              <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2 md:grid-cols-3">
                {products.map((p) => {
                  const low = n(p.stock) <= n(p.low_stock_at), out = n(p.stock) <= 0;
                  return (
                    <div key={p.id} className={cn("group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800", out && "opacity-50")}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-28 w-full object-cover" /> : (
                        <div className="flex h-28 items-center justify-center bg-[#F8FAFC] text-3xl font-extrabold text-indigo-300 dark:bg-slate-700/50 dark:text-indigo-400">{p.name.charAt(0)}</div>
                      )}
                      <div className="p-4">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p>
                        <p className={cn("mt-0.5 text-xs", out || low ? "font-semibold text-[#DC2626]" : "text-slate-400")}>{catName.get(p.category_id) || "—"} • Stock: {n(p.stock)}{out ? " (Out of stock)" : ""}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="tnum text-base font-bold text-[#4F46E5]">{money(p.price)}</span>
                          <button onClick={() => add(p)} disabled={out} aria-label={`Add ${p.name} to cart`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <Card className="h-fit xl:sticky xl:top-24">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4 text-indigo-600" /> Current Sale</h3>
          </div>
          <div className="max-h-[340px] overflow-y-auto px-5 py-3">
            {cart.length === 0 ? (
              <div className="py-10 text-center"><ShoppingCart className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Your cart is empty</p><p className="mt-1 text-[13px] text-slate-400">Click a product to add it to the sale.</p></div>
            ) : cart.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b border-slate-50 py-3 last:border-0 dark:border-slate-800">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{i.name}</p><p className="tnum text-xs text-slate-400">{money(i.price)} each</p></div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQty(i.id, i.qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="tnum w-6 text-center text-sm font-semibold">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <span className="tnum w-16 text-right text-sm font-semibold">{money(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(subtotal)}</span></div>
            <div className="flex items-center justify-between text-slate-500"><span>Discount %</span><Input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className="h-8 w-20 text-right" /></div>
            {discount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span className="tnum font-medium text-emerald-600">−{money(discount)}</span></div>}
            <div className="flex justify-between text-slate-500"><span>Tax ({taxRate}%)</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(tax)}</span></div>
            <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-700"><span className="font-semibold">Total</span><span className="tnum text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">{money(total)}</span></div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCart([])} disabled={!cart.length}><Trash2 className="h-4 w-4" /> Clear</Button>
              <Button className="flex-[2]" onClick={() => { setReceived(""); setPayOpen(true); }} disabled={!cart.length}>Checkout — Pay Now</Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Complete Payment" sub={`Total amount due ${money(total)}`}>
        <div className="space-y-5">
          <Field label="Payment Method">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[["Cash", Banknote], ["Card", CreditCard], ["Digital Wallet", Wallet]].map(([m, Icon]) => (
                <button key={m} onClick={() => setMethod(m)} className={cn("flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition", method === m ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700")}>
                  <Icon className="h-4 w-4" /> {m === "Digital Wallet" ? "Wallet" : m}
                </button>
              ))}
            </div>
          </Field>
          {method === "Cash" && (
            <>
              <Field label="Cash Received">
                <Input type="number" min="0" step="any" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0.00" autoFocus />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[100, 500, 1000, 5000].map((a) => <Button key={a} size="sm" variant="secondary" onClick={() => setReceived(String(a))}>PKR {a}</Button>)}
                <Button size="sm" variant="secondary" onClick={() => setReceived(String(total))}>Exact {money(total)}</Button>
              </div>
              {received !== "" && <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10"><span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Change Due</span><span className="tnum text-lg font-bold text-emerald-700 dark:text-emerald-300">{money(Math.max(0, change))}</span></div>}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel Payment</Button>
            <Button onClick={completeSale} disabled={saving}>{saving ? "Processing…" : `Complete Sale — ${money(total)}`}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
