"use client";
import { useMemo } from "react";
import EntityManager from "@/components/EntityManager";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { docNo, fmtDate, money, n } from "@/lib/utils";
import { statusBadge } from "@/components/ui";

export default function PurchaseReturnsPage() {
  const poQ = useTable("purchases", (q) => q.order("created_at", { ascending: false }));
  const poNo = useMemo(() => new Map(poQ.rows.map((p) => [p.id, p.po_no])), [poQ.rows]);

  async function afterSave(row, editing) {
    // Returning a Received purchase removes its items from stock (once, at creation).
    if (editing || row.status !== "Processed") return;
    const po = poQ.rows.find((p) => p.id === row.purchase_id);
    if (!po || po.status !== "Received") return;
    const sb = supabase(); if (!sb) return;
    const { data: items } = await sb.from("purchase_items").select("*").eq("purchase_id", po.id);
    for (const i of items || []) {
      if (!i.product_id) continue;
      const { data: p } = await sb.from("products").select("stock").eq("id", i.product_id).single();
      if (p) await sb.from("products").update({ stock: Math.max(0, n(p.stock) - n(i.qty)) }).eq("id", i.product_id);
      await sb.from("stock_movements").insert({ product_id: i.product_id, branch_id: po.branch_id, type: "Purchase Return", qty: -n(i.qty), ref: row.return_no });
    }
    await logAudit("Purchase Return Stock-Out", `${row.return_no} against ${po.po_no}`);
  }

  return (
    <EntityManager title="Purchase Returns" sub="Return goods to suppliers and track refunds" table="purchase_returns" entityName="Purchase Return" addLabel="New Purchase Return"
      searchKeys={["return_no", "reason"]}
      formDefaults={{ return_no: "", purchase_id: "", amount: "", status: "Processed", reason: "" }}
      transformSave={(v, editing) => ({ ...v, return_no: editing ? v.return_no : (v.return_no || docNo("PRT")) })}
      afterSave={afterSave}
      fields={[
        { key: "purchase_id", label: "Purchase Order", type: "select", required: true, span: 2, optionsFrom: { rows: poQ.rows.map((p) => ({ id: p.id, name: `${p.po_no} — ${money(p.total)}` })) } },
        { key: "amount", label: "Refund Amount ($)", type: "number", required: true, placeholder: "0.00" },
        { key: "status", label: "Status", type: "select", options: [{ value: "Processed", label: "Processed" }, { value: "Pending", label: "Pending" }, { value: "Rejected", label: "Rejected" }] },
        { key: "reason", label: "Reason", span: 2, placeholder: "e.g. Damaged goods received" },
      ]}
      columns={[
        { label: "Return ID", render: (r) => <span className="font-bold text-[#4F46E5]">{r.return_no}</span> },
        { label: "Purchase Order", render: (r) => poNo.get(r.purchase_id) || "—" },
        { label: "Date", render: (r) => <span className="text-slate-500">{fmtDate(r.created_at)}</span> },
        { label: "Reason", render: (r) => r.reason || "—" },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Amount", align: "right", render: (r) => money(r.amount) },
      ]} />
  );
}
