"use client";
import { useMemo, useState } from "react";
import { Banknote } from "lucide-react";
import EntityManager from "@/components/EntityManager";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { money, n, round2 } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, useToast } from "@/components/ui";

export default function CustomersPage() {
  const toast = useToast();
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: true }));
  const [payCust, setPayCust] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [saving, setSaving] = useState(false);

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

  const pendingInvoices = useMemo(() => {
    if (!payCust) return [];
    return salesQ.rows.filter((s) => s.customer_id === payCust.id && n(s.total) > n(s.amount_paid));
  }, [salesQ.rows, payCust]);

  function openPay(c) {
    const due = round2(Math.max(0, t(c.id).purchases - t(c.id).paid));
    setPayCust(c);
    setPayAmt(String(due));
  }

  async function receivePayment(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return;
    let rem = round2(n(payAmt));
    if (rem <= 0) return toast("Enter a valid payment amount.", "warn");
    setSaving(true);
    for (const inv of pendingInvoices) {
      if (rem <= 0) break;
      const due = round2(n(inv.total) - n(inv.amount_paid));
      const apply = Math.min(rem, due);
      const nextPaid = round2(n(inv.amount_paid) + apply);
      const nextStatus = nextPaid >= n(inv.total) ? "Paid" : "Pending";
      await sb.from("sales").update({ amount_paid: nextPaid, status: nextStatus }).eq("id", inv.id);
      rem = round2(rem - apply);
    }
    await logAudit("Customer Payment", `Received ${money(n(payAmt))} from ${payCust.name}`);
    toast(`Payment of ${money(n(payAmt))} recorded for ${payCust.name}.`);
    setSaving(false); setPayCust(null); salesQ.reload();
  }

  return (
    <>
      <EntityManager title="Customers & Credit" sub="Customer profiles and outstanding balances — totals computed from sales" table="customers" entityName="Customer" addLabel="Add New Customer"
        searchKeys={["name", "email", "phone"]}
        formDefaults={{ name: "", email: "", phone: "", address: "" }}
        fields={[
          { key: "name", label: "Full Name", required: true, placeholder: "e.g. Ali Khan" },
          { key: "email", label: "Email", type: "email", placeholder: "ali@example.com" },
          { key: "phone", label: "Phone", placeholder: "+92 300 1234567" },
          { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "Street, City" },
        ]}
        rowActions={(c) => {
          const due = Math.max(0, t(c.id).purchases - t(c.id).paid);
          return due > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => openPay(c)} className="h-7 px-2 text-[11.5px] text-emerald-700 dark:text-emerald-400">
              <Banknote className="h-3.5 w-3.5" /> Receive
            </Button>
          ) : null;
        }}
        columns={[
          { label: "Customer", render: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span> },
          { label: "Contact", render: (c) => <span className="text-slate-500">{[c.email, c.phone].filter(Boolean).join(" • ") || "—"}</span> },
          { label: "Total Purchases", align: "right", render: (c) => money(t(c.id).purchases) },
          { label: "Outstanding", align: "right", render: (c) => money(Math.max(0, t(c.id).purchases - t(c.id).paid)) },
          { label: "Status", render: (c) => { const due = Math.max(0, t(c.id).purchases - t(c.id).paid); return due > 0 ? <Badge tone="amber">Due</Badge> : <Badge tone="green">Active</Badge>; } },
        ]} />

      <Modal open={!!payCust} onClose={() => setPayCust(null)} title="Receive Customer Payment" sub={payCust ? `${payCust.name} — ${pendingInvoices.length} unpaid invoice(s)` : ""}>
        <form onSubmit={receivePayment} className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex justify-between"><span className="text-slate-500">Total Outstanding Due</span><span className="tnum font-bold text-red-600">{payCust ? money(Math.max(0, t(payCust.id).purchases - t(payCust.id).paid)) : ""}</span></div>
          </div>
          <Field label="Amount Received (PKR)" required>
            <Input type="number" step="any" min="1" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} required autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayCust(null)}>Cancel</Button>
            <Button type="submit" variant="green" disabled={saving}>{saving ? "Recording…" : "Record Payment"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
