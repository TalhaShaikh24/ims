"use client";
import { useEffect, useMemo, useState } from "react";
import { Banknote, BookOpen } from "lucide-react";
import EntityManager from "@/components/EntityManager";
import { supabase } from "@/lib/supabase";
import { getSetting, logAudit, setSetting, useTable } from "@/lib/data";
import { fmtDate, money, n, round2 } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, Select, useToast } from "@/components/ui";

export default function CustomersPage() {
  const toast = useToast();
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: true }));
  const [ledger, setLedger] = useState({ customer_advances: {}, supplier_advances: {}, entries: [] });
  const [payCust, setPayCust] = useState(null);
  const [ledgerCust, setLedgerCust] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting("party_ledger", { customer_advances: {}, supplier_advances: {}, entries: [] }).then((v) => {
      if (v && typeof v === "object") setLedger({ customer_advances: v.customer_advances || {}, supplier_advances: v.supplier_advances || {}, entries: Array.isArray(v.entries) ? v.entries : [] });
    });
  }, []);

  const totals = useMemo(() => {
    const m = new Map();
    salesQ.rows.forEach((s) => {
      if (!s.customer_id) return;
      const cur = m.get(s.customer_id) || { purchases: 0, paid: 0 };
      cur.purchases += n(s.total); cur.paid += n(s.amount_paid);
      m.set(s.customer_id, cur);
    });
    return m;
  }, [salesQ.rows]);
  const t = (id) => totals.get(id) || { purchases: 0, paid: 0 };
  const advOf = (id) => round2(n(ledger.customer_advances?.[id]));

  const pendingInvoices = useMemo(() => {
    if (!payCust) return [];
    return salesQ.rows.filter((s) => s.customer_id === payCust.id && n(s.total) > n(s.amount_paid));
  }, [salesQ.rows, payCust]);

  function openPay(c) {
    const due = round2(Math.max(0, t(c.id).purchases - t(c.id).paid));
    setPayCust(c);
    setPayAmt(due > 0 ? String(due) : "");
    setPayMethod("Cash");
    setPayNote("");
  }

  async function receivePayment(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return;
    const totalAmt = round2(n(payAmt));
    if (totalAmt <= 0) return toast("Enter a valid amount.", "warn");
    setSaving(true);
    let rem = totalAmt;
    for (const inv of pendingInvoices) {
      if (rem <= 0) break;
      const due = round2(n(inv.total) - n(inv.amount_paid));
      const apply = Math.min(rem, due);
      const nextPaid = round2(n(inv.amount_paid) + apply);
      const nextStatus = nextPaid >= n(inv.total) ? "Paid" : "Pending";
      await sb.from("sales").update({ amount_paid: nextPaid, status: nextStatus }).eq("id", inv.id);
      rem = round2(rem - apply);
    }
    const prevAdv = advOf(payCust.id);
    const nextAdv = round2(prevAdv + rem);
    const entry = {
      id: Date.now().toString(36),
      party_type: "customer",
      party_id: payCust.id,
      party_name: payCust.name,
      kind: rem > 0 && rem === totalAmt ? "advance" : rem > 0 ? "payment+advance" : "payment",
      amount: totalAmt,
      advance_added: rem,
      method: payMethod,
      note: payNote.trim(),
      created_at: new Date().toISOString(),
    };
    const nextLedger = {
      ...ledger,
      customer_advances: { ...ledger.customer_advances, [payCust.id]: nextAdv },
      entries: [entry, ...ledger.entries].slice(0, 200),
    };
    await setSetting("party_ledger", nextLedger);
    setLedger(nextLedger);
    await logAudit("Customer Receipt", `Received ${money(totalAmt)} from ${payCust.name}${rem > 0 ? ` (${money(rem)} as Advance)` : ""}`);
    toast(rem > 0 ? `Recorded ${money(totalAmt)} (${money(rem)} added to Advance).` : `Payment of ${money(totalAmt)} recorded.`);
    setSaving(false); setPayCust(null); salesQ.reload();
  }

  const custEntries = useMemo(() => ledgerCust ? ledger.entries.filter((e) => e.party_type === "customer" && e.party_id === ledgerCust.id) : [], [ledger.entries, ledgerCust]);

  return (
    <>
      <EntityManager title="Customers & Credit" sub="Customer profiles, dues, advance balances, and payment receipts" table="customers" entityName="Customer" addLabel="Add New Customer"
        searchKeys={["name", "email", "phone"]}
        formDefaults={{ name: "", email: "", phone: "", address: "" }}
        fields={[
          { key: "name", label: "Full Name", required: true, placeholder: "e.g. Ali Khan" },
          { key: "email", label: "Email", type: "email", placeholder: "ali@example.com" },
          { key: "phone", label: "Phone", placeholder: "+92 300 1234567" },
          { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "Street, City" },
        ]}
        rowActions={(c) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => openPay(c)} className="h-7 px-2 text-[11.5px] text-emerald-700 dark:text-emerald-400" title="Receive payment or advance">
              <Banknote className="h-3.5 w-3.5" /> Receive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLedgerCust(c)} className="h-7 px-2 text-[11.5px]" title="View payment & advance ledger">
              <BookOpen className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        columns={[
          { label: "Customer", render: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span> },
          { label: "Contact", render: (c) => <span className="text-slate-500">{[c.email, c.phone].filter(Boolean).join(" • ") || "—"}</span> },
          { label: "Total Purchases", align: "right", render: (c) => money(t(c.id).purchases) },
          { label: "Due / Advance", align: "right", render: (c) => {
            const due = round2(Math.max(0, t(c.id).purchases - t(c.id).paid));
            const adv = advOf(c.id);
            if (due > 0) return <span className="font-bold text-red-600">Due: {money(due)}</span>;
            if (adv > 0) return <span className="font-bold text-emerald-600">Adv: {money(adv)}</span>;
            return <span className="text-slate-400">PKR 0.00</span>;
          } },
          { label: "Status", render: (c) => {
            const due = Math.max(0, t(c.id).purchases - t(c.id).paid);
            const adv = advOf(c.id);
            return due > 0 ? <Badge tone="amber">Due</Badge> : adv > 0 ? <Badge tone="indigo">Advance</Badge> : <Badge tone="green">Settled</Badge>;
          } },
        ]} />

      <Modal open={!!payCust} onClose={() => setPayCust(null)} title="Receive Payment / Advance" sub={payCust ? `${payCust.name} — settles unpaid invoices first, extra is saved as Advance` : ""}>
        <form onSubmit={receivePayment} className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex justify-between"><span className="text-slate-500">Outstanding Due</span><span className="tnum font-bold text-red-600">{payCust ? money(Math.max(0, t(payCust.id).purchases - t(payCust.id).paid)) : ""}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Current Advance Balance</span><span className="tnum font-bold text-emerald-600">{payCust ? money(advOf(payCust.id)) : ""}</span></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount Received (PKR)" required>
              <Input type="number" step="any" min="1" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="0.00" required autoFocus />
            </Field>
            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Digital Wallet</option>
              </Select>
            </Field>
          </div>
          <Field label="Note (optional)">
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Advance for upcoming order" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayCust(null)}>Cancel</Button>
            <Button type="submit" variant="green" disabled={saving}>{saving ? "Recording…" : "Save Receipt"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!ledgerCust} onClose={() => setLedgerCust(null)} title={`Ledger — ${ledgerCust?.name || ""}`} sub="Payment & advance history" wide>
        {custEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No payment or advance entries recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {custEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{e.kind === "advance" ? "Advance Received" : e.kind === "payment+advance" ? "Due + Advance Received" : e.kind === "advance_used" ? "Advance Applied on POS" : "Due Payment Received"} <span className="text-xs text-slate-400">({e.method})</span></p>
                  <p className="text-xs text-slate-400">{fmtDate(e.created_at, true)}{e.note ? ` • ${e.note}` : ""}</p>
                </div>
                <span className={`tnum font-bold ${e.kind === "advance_used" ? "text-amber-600" : "text-emerald-600"}`}>{e.kind === "advance_used" ? `−${money(e.amount)}` : `+${money(e.amount)}`}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
