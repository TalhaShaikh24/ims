"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock, CreditCard, Minus, Pause, Play, Plus, Search, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSetting, logAudit, setSetting, useTable } from "@/lib/data";
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
  const [discountType, setDiscountType] = useState("pct");
  const [discountVal, setDiscountVal] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("Cash");
  const [received, setReceived] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);
  const [ledger, setLedger] = useState({ customer_advances: {}, supplier_advances: {}, entries: [] });
  const [useAdvance, setUseAdvance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState(null);

  useEffect(() => {
    getSetting("org", { tax_rate: 0 }).then((o) => setTaxRate(n(o?.tax_rate ?? 0)));
    getSetting("party_ledger", { customer_advances: {}, supplier_advances: {}, entries: [] }).then((v) => {
      if (v && typeof v === "object") setLedger({ customer_advances: v.customer_advances || {}, supplier_advances: v.supplier_advances || {}, entries: Array.isArray(v.entries) ? v.entries : [] });
    });
    try { const h = localStorage.getItem("xona_hold"); if (h) setHeld(JSON.parse(h)); } catch {}
  }, []);

  const custAdvance = customerId ? round2(n(ledger.customer_advances?.[customerId])) : 0;

  const products = useMemo(() => prodQ.rows.filter((p) => (cat === "all" || p.category_id === cat) && (p.name + " " + (p.sku || "")).toLowerCase().includes(search.toLowerCase())), [prodQ.rows, cat, search]);
  const catName = useMemo(() => new Map(catQ.rows.map((c) => [c.id, c.name])), [catQ.rows]);

  const itemCalc = (i) => {
    const gross = round2(n(i.price) * i.qty);
    const disc = i.discType === "amt"
      ? Math.min(gross, Math.max(0, round2(n(i.discVal))))
      : round2(gross * (Math.min(100, Math.max(0, n(i.discVal))) / 100));
    return { gross, disc, net: round2(Math.max(0, gross - disc)) };
  };

  const subtotal = round2(cart.reduce((a, i) => a + itemCalc(i).gross, 0));
  const itemDiscount = round2(cart.reduce((a, i) => a + itemCalc(i).disc, 0));
  const afterItemDisc = round2(Math.max(0, subtotal - itemDiscount));
  const wholeDiscount = discountType === "amt"
    ? Math.min(afterItemDisc, Math.max(0, round2(n(discountVal))))
    : round2(afterItemDisc * (Math.min(100, Math.max(0, n(discountVal))) / 100));
  const discount = round2(itemDiscount + wholeDiscount);
  const taxable = round2(Math.max(0, afterItemDisc - wholeDiscount));
  const tax = round2(taxable * (n(taxRate) / 100));
  const total = round2(taxable + tax);
  const change = round2(n(received) - total);

  function add(p) {
    if (n(p.stock) <= 0) return toast(`${p.name} is out of stock.`, "warn");
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id);
      if (ex) return c.map((i) => i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, n(p.stock)) } : i);
      return [...c, { id: p.id, name: p.name, price: n(p.price), cost: n(p.cost), stock: n(p.stock), qty: 1, discType: "pct", discVal: 0 }];
    });
  }
  const setQty = (id, qty) => setCart((c) => qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => i.id === id ? { ...i, qty: Math.min(qty, i.stock) } : i));
  const setItemPrice = (id, price) => setCart((c) => c.map((i) => i.id === id ? { ...i, price } : i));
  const setItemDisc = (id, patch) => setCart((c) => c.map((i) => i.id === id ? { ...i, ...patch } : i));

  function hold() { localStorage.setItem("xona_hold", JSON.stringify(cart)); setHeld(cart); setCart([]); toast("Sale held — resume it any time."); }
  function resume() { if (held) { setCart(held); localStorage.removeItem("xona_hold"); setHeld(null); } }

  async function completeSale() {
    const sb = supabase(); if (!sb) return toast("Supabase is not configured — open the Setup page.", "error");
    const advApplied = useAdvance && custAdvance > 0 ? Math.min(custAdvance, total) : 0;
    const netDueAfterAdv = round2(Math.max(0, total - advApplied));
    const isCredit = method === "Credit";
    const isPartial = isCredit || (allowPartial && received !== "" && n(received) < netDueAfterAdv);
    if ((isPartial || advApplied > 0) && !customerId) return toast("Please select a customer for Credit / Partial / Advance payment.", "warn");
    if (method === "Cash" && !allowPartial && received !== "" && n(received) < netDueAfterAdv) return toast("Cash received is less than the remaining total due.", "error");
    const cashOrCardPaid = isCredit ? 0 : (isPartial ? Math.max(0, round2(n(received))) : netDueAfterAdv);
    const paidAmount = round2(Math.min(total, advApplied + cashOrCardPaid));
    const saleStatus = paidAmount >= total ? "Paid" : "Pending";
    setSaving(true);
    const branch_id = branchId !== "all" ? branchId : (branches.find((b) => b.is_main)?.id || branches[0]?.id || null);
    const invoice_no = docNo("INV");
    const { data: sale, error } = await sb.from("sales").insert({
      invoice_no, customer_id: customerId || null, branch_id, payment_method: method,
      status: saleStatus, subtotal, discount, tax_rate: n(taxRate), tax_amount: tax, total, amount_paid: paidAmount,
      cashier_name: localStorage.getItem("xona_profile_name") || "Admin",
    }).select().single();
    if (error) { setSaving(false); return toast(error.message, "error"); }
    const items = cart.map((i) => ({ sale_id: sale.id, product_id: i.id, product_name: i.name, price: n(i.price), cost: i.cost, qty: i.qty, line_total: itemCalc(i).net }));
    const { error: iErr } = await sb.from("sale_items").insert(items);
    if (iErr) { setSaving(false); return toast(iErr.message, "error"); }
    for (const i of cart) {
      const fresh = prodQ.rows.find((p) => p.id === i.id);
      await sb.from("products").update({ stock: n(fresh?.stock) - i.qty }).eq("id", i.id);
      await sb.from("stock_movements").insert({ product_id: i.id, branch_id, type: "Sale", qty: -i.qty, ref: invoice_no });
    }
    if (advApplied > 0 && customerId) {
      const cust = custQ.rows.find((c) => c.id === customerId);
      const nextLedger = {
        ...ledger,
        customer_advances: { ...ledger.customer_advances, [customerId]: round2(Math.max(0, custAdvance - advApplied)) },
        entries: [{ id: Date.now().toString(36), party_type: "customer", party_id: customerId, party_name: cust?.name || "Customer", kind: "advance_used", amount: advApplied, method: "POS", note: invoice_no, created_at: new Date().toISOString() }, ...ledger.entries].slice(0, 200),
      };
      await setSetting("party_ledger", nextLedger);
      setLedger(nextLedger);
    }
    await logAudit("Sale", `${invoice_no} — ${money(total)} (${method})`);
    setSaving(false); setPayOpen(false); setCart([]); setUseAdvance(false);
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
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    const q = search.trim().toLowerCase();
                    const exact = prodQ.rows.find((p) => (p.sku || "").toLowerCase() === q) || (products.length === 1 ? products[0] : null);
                    if (exact) { add(exact); setSearch(""); toast(`Added ${exact.name}`); }
                  }
                }}
                placeholder="Scan barcode / SKU (Enter) or search product…"
                className="w-full pl-9"
              />
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
                          <span className="tnum text-base font-bold text-[#4F46E5]">{n(p.price) > 0 ? money(p.price) : <span className="text-xs font-semibold text-slate-400">Set at POS</span>}</span>
                          <button onClick={() => add(p)} disabled={out} aria-label={`Add ${p.name} to cart`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <Card className="h-fit xl:sticky xl:top-18">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white"><ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Current Sale</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{cart.reduce((a, i) => a + i.qty, 0)} items</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto px-4 py-2.5">
            {cart.length === 0 ? (
              <div className="py-8 text-center"><ShoppingCart className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2.5 text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">Your cart is empty</p><p className="mt-0.5 text-[12.5px] text-slate-400">Click a product to add it to the sale.</p></div>
            ) : cart.map((i) => {
              const calc = itemCalc(i);
              return (
                <div key={i.id} className="border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{i.name}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[11px] text-slate-400">Rate:</span>
                        <Input type="number" min="0" step="any" value={i.price} onChange={(e) => setItemPrice(i.id, e.target.value)} placeholder="0" className="!h-6 !w-20 px-1.5 text-right text-[11.5px] font-semibold" aria-label={`Rate for ${i.name}`} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => setQty(i.id, i.qty - 1)} className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700"><Minus className="h-3 w-3" /></button>
                      <span className="tnum w-5 text-center text-[12.5px] font-semibold">{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tnum block text-[13px] font-bold text-slate-800 dark:text-slate-100">{money(calc.net)}</span>
                      {calc.disc > 0 && <span className="tnum block text-[10.5px] text-emerald-600">−{money(calc.disc)}</span>}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">Item Discount</span>
                    <div className="flex items-center gap-1">
                      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                        {[["pct", "%"], ["amt", "PKR"]].map(([t, lbl]) => (
                          <button key={t} type="button" onClick={() => setItemDisc(i.id, { discType: t })} className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold transition", (i.discType || "pct") === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>{lbl}</button>
                        ))}
                      </div>
                      <Input type="number" min="0" step="any" value={i.discVal ?? 0} onChange={(e) => setItemDisc(i.id, { discVal: e.target.value })} className="!h-6.5 !w-16 px-1.5 text-right text-[11.5px]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 text-[13px] dark:border-slate-800 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-slate-500"><span>Subtotal</span><span className="tnum font-semibold text-slate-800 dark:text-slate-100">{money(subtotal)}</span></div>
            {itemDiscount > 0 && <div className="flex items-center justify-between text-slate-500"><span>Item Discounts</span><span className="tnum font-medium text-emerald-600">−{money(itemDiscount)}</span></div>}
            <div className="flex items-center justify-between gap-2 text-slate-500">
              <span className="whitespace-nowrap">Sale Discount</span>
              <div className="flex items-center gap-1.5">
                {wholeDiscount > 0 && <span className="tnum text-[11.5px] font-medium text-emerald-600">−{money(wholeDiscount)}</span>}
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  {[["pct", "%"], ["amt", "PKR"]].map(([t, lbl]) => (
                    <button key={t} type="button" onClick={() => setDiscountType(t)} className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-bold transition", discountType === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>{lbl}</button>
                  ))}
                </div>
                <Input type="number" min="0" step="any" value={discountVal} onChange={(e) => setDiscountVal(e.target.value)} className="!h-8 !w-18 shrink-0 text-right text-[12.5px]" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-slate-500">
              <span className="whitespace-nowrap">Tax (%)</span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[12px] font-medium text-slate-600 dark:text-slate-300">{money(tax)}</span>
                <Input type="number" min="0" max="100" step="any" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="!h-8 !w-18 shrink-0 text-right text-[12.5px]" />
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-700"><span className="font-bold text-slate-700 dark:text-slate-200">Total</span><span className="tnum text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{money(total)}</span></div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => { setCart([]); setDiscountVal(0); }} disabled={!cart.length}><Trash2 className="h-4 w-4" /> Clear</Button>
              <Button className="flex-[2]" onClick={() => { setReceived(""); setPayOpen(true); }} disabled={!cart.length}>Checkout — Pay Now</Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Complete Payment" sub={`Total amount due ${money(total)}`}>
        <div className="space-y-5">
          {custAdvance > 0 && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                <input type="checkbox" checked={useAdvance} onChange={(e) => setUseAdvance(e.target.checked)} className="h-4 w-4 rounded accent-emerald-600" />
                Apply Customer Advance ({money(custAdvance)} available)
              </span>
              {useAdvance && <span className="tnum font-bold text-emerald-700 dark:text-emerald-300">−{money(Math.min(custAdvance, total))}</span>}
            </label>
          )}
          <Field label="Payment Method">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Cash", Banknote], ["Card", CreditCard], ["Digital Wallet", Wallet], ["Credit", Clock]].map(([m, Icon]) => (
                <button key={m} onClick={() => setMethod(m)} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition sm:text-sm", method === m ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700")}>
                  <Icon className="h-4 w-4" /> {m === "Digital Wallet" ? "Wallet" : m}
                </button>
              ))}
            </div>
          </Field>
          {method === "Credit" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[12.5px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {customerId ? "Full amount will be recorded as Customer Credit (Pending due)." : "Please select a customer above to record a Credit sale."}
            </div>
          )}
          {method === "Cash" && (
            <>
              <Field label="Cash Received">
                <Input type="number" min="0" step="any" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0.00" autoFocus />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[100, 500, 1000, 5000].map((a) => <Button key={a} size="sm" variant="secondary" onClick={() => setReceived(String(a))}>PKR {a}</Button>)}
                <Button size="sm" variant="secondary" onClick={() => setReceived(String(total))}>Exact {money(total)}</Button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} className="h-4 w-4 rounded accent-blue-600" />
                Allow partial payment (record remaining balance as customer due)
              </label>
              {received !== "" && n(received) >= total && <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10"><span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Change Due</span><span className="tnum text-lg font-bold text-emerald-700 dark:text-emerald-300">{money(Math.max(0, change))}</span></div>}
              {allowPartial && received !== "" && n(received) < total && <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-500/10"><span className="text-sm font-medium text-amber-700 dark:text-amber-300">Remaining Due (Credit)</span><span className="tnum text-lg font-bold text-amber-700 dark:text-amber-300">{money(Math.max(0, total - n(received)))}</span></div>}
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
