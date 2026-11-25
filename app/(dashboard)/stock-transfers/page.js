"use client";
import { useMemo } from "react";
import EntityManager from "@/components/EntityManager";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { docNo, fmtDate, n } from "@/lib/utils";
import { statusBadge } from "@/components/ui";

export default function StockTransfersPage() {
  const branchQ = useTable("branches", (q) => q.order("name"));
  const prodQ = useTable("products", (q) => q.order("name"));
  const branchName = useMemo(() => new Map(branchQ.rows.map((b) => [b.id, b.name])), [branchQ.rows]);
  const prodName = useMemo(() => new Map(prodQ.rows.map((p) => [p.id, p.name])), [prodQ.rows]);

  async function afterSave(row, editing) {
    // Stock is global per product in this schema — record both movement legs when a transfer is Received.
    if (row.status === "Received" && (!editing || editing.status !== "Received")) {
      const sb = supabase(); if (!sb) return;
      await sb.from("stock_movements").insert([
        { product_id: row.product_id, branch_id: row.from_branch_id, type: "Transfer Out", qty: -n(row.qty), ref: row.transfer_no },
        { product_id: row.product_id, branch_id: row.to_branch_id, type: "Transfer In", qty: n(row.qty), ref: row.transfer_no },
      ]);
      await logAudit("Stock Transfer Received", `${row.transfer_no} — ${prodName.get(row.product_id) || "product"} × ${n(row.qty)}`);
    }
  }

  return (
    <EntityManager title="Stock Transfers" sub="Move inventory between branches and manage transfer requests" table="stock_transfers" entityName="Transfer" addLabel="New Stock Transfer"
      searchKeys={["transfer_no", "notes"]}
      formDefaults={{ transfer_no: "", from_branch_id: "", to_branch_id: "", product_id: "", qty: "", status: "Pending", notes: "" }}
      transformSave={(v, editing) => ({ ...v, transfer_no: editing ? v.transfer_no : (v.transfer_no || docNo("TRF")) })}
      afterSave={afterSave}
      fields={[
        { key: "from_branch_id", label: "From Branch", type: "select", required: true, optionsFrom: { rows: branchQ.rows } },
        { key: "to_branch_id", label: "To Branch", type: "select", required: true, optionsFrom: { rows: branchQ.rows } },
        { key: "product_id", label: "Product", type: "select", required: true, span: 2, optionsFrom: { rows: prodQ.rows } },
        { key: "qty", label: "Quantity to Transfer", type: "number", required: true, placeholder: "0" },
        { key: "status", label: "Status", type: "select", options: [{ value: "Pending", label: "Pending" }, { value: "Approved", label: "Approved" }, { value: "In Transit", label: "In Transit" }, { value: "Received", label: "Received" }, { value: "Rejected", label: "Rejected" }] },
        { key: "notes", label: "Notes (optional)", type: "textarea", span: 2, placeholder: "Reason for transfer…" },
      ]}
      columns={[
        { label: "Transfer", render: (t) => <span className="font-bold text-[#4F46E5]">{t.transfer_no}</span> },
        { label: "Date", render: (t) => <span className="text-slate-500">{fmtDate(t.created_at)}</span> },
        { label: "From → To", render: (t) => `${branchName.get(t.from_branch_id) || "—"} → ${branchName.get(t.to_branch_id) || "—"}` },
        { label: "Product", render: (t) => prodName.get(t.product_id) || "—" },
        { label: "Qty", align: "center", render: (t) => n(t.qty) },
        { label: "Status", render: (t) => statusBadge(t.status) },
      ]} />
  );
}
