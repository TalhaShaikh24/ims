"use client";
import { useEffect, useMemo, useState } from "react";
import { Banknote, BookOpen } from "lucide-react";
import EntityManager from "@/components/EntityManager";
import { supabase } from "@/lib/supabase";
import { getSetting, logAudit, setSetting, useTable } from "@/lib/data";
import { fmtDate, money, n, round2 } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, Select, useToast } from "@/components/ui";

export default function SuppliersPage() {
  const toast = useToast();
  const poQ = useTable("purchases", (q) => q.order("created_at", { ascending: true }));
  const [ledger, setLedger] = useState({ customer_advances: {}, supplier_advances: {}, entries: [] });
  const [paySup, setPaySup] = useState(null);
  const [ledgerSup, setLedgerSup] = useState(null);
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
    poQ.rows.forEach((p) => {
      const cur = m.get(p.supplier_id) || { purchases: 0, paid: 0 };
      cur.purchases += n(p.total); cur.paid += n(p.amount_paid);
      m.set(p.supplier_id, cur);
    });
    return m;
  }, [poQ.rows]);
  const t = (id) => totals.get(id) || { purchases: 0, paid: 0 };
  const advOf = (id) => round2(n(ledger.supplier_advances?.[id]));

  const unpaidPOs = useMemo(() => {
    if (!paySup) return [];
    return poQ.rows.filter((p) => p.supplier_id === paySup.id && n(p.total) > n(p.amount_paid));
  }, [poQ.rows, paySup]);

  function openPay(s) {
    const due = round2(Math.max(0, t(s.id).purchases - t(s.id).paid));
    setPaySup(s);
    setPayAmt(due > 0 ? String(due) : "");
    setPayMethod("Cash");
    setPayNote("");
  }

  async function makePayment(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return;
    const totalAmt = round2(n(payAmt));
    if (totalAmt <= 0) return toast("Enter a valid amount.", "warn");
    setSaving(true);
    let rem = totalAmt;
    for (const po of unpaidPOs) {
      if (rem <= 0) break;
      const due = round2(n(po.total) - n(po.amount_paid));
      const apply = Math.min(rem, due);
      const nextPaid = round2(n(po.amount_paid) + apply);
      await sb.from("purchases").update({ amount_paid: nextPaid }).eq("id", po.id);
      rem = round2(rem - apply);
    }
    const prevAdv = advOf(paySup.id);
    const nextAdv = round2(prevAdv + rem);
    const entry = {
      id: Date.now().toString(36),
      party_type: "supplier",
      party_id: paySup.id,
      party_name: paySup.name,
      kind: rem > 0 && rem === totalAmt ? "advance" : rem > 0 ? "payment+advance" : "payment",
      amount: totalAmt,
      advance_added: rem,
      method: payMethod,
      note: payNote.trim(),
      created_at: new Date().toISOString(),
    };
    const nextLedger = {
      ...ledger,
      supplier_advances: { ...ledger.supplier_advances, [paySup.id]: nextAdv },
      entries: [entry, ...ledger.entries].slice(0, 200),
    };
    await setSetting("party_ledger", nextLedger);
    setLedger(nextLedger);
    await logAudit("Supplier Payment", `Paid ${money(totalAmt)} to ${paySup.name}${rem > 0 ? ` (${money(rem)} as Advance)` : ""}`);
    toast(rem > 0 ? `Paid ${money(totalAmt)} (${money(rem)} recorded as Advance).` : `Payment of ${money(totalAmt)} recorded.`);
    setSaving(false); setPaySup(null); poQ.reload();
  }

  const supEntries = useMemo(() => ledgerSup ? ledger.entries.filter((e) => e.party_type === "supplier" && e.party_id === ledgerSup.id) : [], [ledger.entries, ledgerSup]);

  return (
    <>
      <EntityManager title="Suppliers & Dues" sub="Supplier accounts, purchase dues, advance payments, and settlement history" table="suppliers" entityName="Supplier" addLabel="Add New Supplier"
        searchKeys={["name", "contact_name", "email", "phone"]}
        formDefaults={{ name: "", contact_name: "", email: "", phone: "", address: "" }}
        fields={[
          { key: "name", label: "Supplier Name", required: true, placeholder: "e.g. Apex Electronics Supply" },
          { key: "contact_name", label: "Contact Person", placeholder: "e.g. Bilal Ahmed" },
          { key: "email", label: "Email", type: "email", placeholder: "supplier@example.com" },
          { key: "phone", label: "Phone", placeholder: "+92 300 1234567" },
          { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "Street, City" },
        ]}
        rowActions={(s) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => openPay(s)} className="h-7 px-2 text-[11.5px] text-blue-700 dark:text-blue-400" title="Pay due or advance">
              <Banknote className="h-3.5 w-3.5" /> Pay
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLedgerSup(s)} className="h-7 px-2 text-[11.5px]" title="View payment & advance ledger">
              <BookOpen className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        columns={[
          { label: "Supplier", render: (s) => <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span> },
          { label: "Contact", render: (s) => <span className="text-slate-500">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" • ") || "—"}</span> },
          { label: "Total Purchases", align: "right", render: (s) => money(t(s.id).purchases) },
          { label: "Total Paid", align: "right", render: (s) => money(t(s.id).paid) },
          { label: "Due / Advance", align: "right", render: (s) => {
            const due = round2(Math.max(0, t(s.id).purchases - t(s.id).paid));
            const adv = advOf(s.id);
            if (due > 0) return <span className="font-bold text-red-600">Due: {money(due)}</span>;
            if (adv > 0) return <span className="font-bold text-emerald-600">Adv: {money(adv)}</span>;
            return <span className="text-slate-400">PKR 0.00</span>;
          } },
          { label: "Status", render: (s) => {
            const due = Math.max(0, t(s.id).purchases - t(s.id).paid);
            const adv = advOf(s.id);
            return due > 0 ? <Badge tone="red">Due</Badge> : adv > 0 ? <Badge tone="indigo">Advance</Badge> : <Badge tone="green">Settled</Badge>;
          } },
        ]} />

      <Modal open={!!paySup} onClose={() => setPaySup(null)} title="Pay Supplier / Advance" sub={paySup ? `${paySup.name} — settles unpaid POs first, extra is saved as Advance` : ""}>
        <form onSubmit={makePayment} className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex justify-between"><span className="text-slate-500">Outstanding Payable</span><span className="tnum font-bold text-red-600">{paySup ? money(Math.max(0, t(paySup.id).purchases - t(paySup.id).paid)) : ""}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Advance Paid to Supplier</span><span className="tnum font-bold text-emerald-600">{paySup ? money(advOf(paySup.id)) : ""}</span></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount Paid (PKR)" required>
              <Input type="number" step="any" min="1" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="0.00" required autoFocus />
            </Field>
            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option>
              </Select>
            </Field>
          </div>
          <Field label="Note (optional)">
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Advance for next stock order" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaySup(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Recording…" : "Record Payment"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!ledgerSup} onClose={() => setLedgerSup(null)} title={`Ledger — ${ledgerSup?.name || ""}`} sub="Payment & advance history" wide>
        {supEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No payment or advance entries recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {supEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{e.kind === "advance" ? "Advance Paid" : e.kind === "payment+advance" ? "PO Due + Advance Paid" : "PO Payment"} <span className="text-xs text-slate-400">({e.method})</span></p>
                  <p className="text-xs text-slate-400">{fmtDate(e.created_at, true)}{e.note ? ` • ${e.note}` : ""}</p>
                </div>
                <span className="tnum font-bold text-blue-600">−{money(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
