"use client";
import { useMemo } from "react";
import EntityManager from "@/components/EntityManager";
import { useTable } from "@/lib/data";
import { money, n } from "@/lib/utils";
import { Badge } from "@/components/ui";

export default function SuppliersPage() {
  const poQ = useTable("purchases");
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
  const dueStatus = (due, purchases) => due <= 0 ? <Badge tone="green">Settled</Badge> : purchases > 0 && due / purchases > 0.05 ? <Badge tone="red">Overdue</Badge> : <Badge tone="amber">Due Soon</Badge>;

  return (
    <EntityManager title="Suppliers & Dues" sub="Supplier relationships and outstanding payments — totals computed from purchase orders" table="suppliers" entityName="Supplier" addLabel="Add New Supplier"
      searchKeys={["name", "contact_name", "email", "phone"]}
      formDefaults={{ name: "", contact_name: "", email: "", phone: "", address: "" }}
      fields={[
        { key: "name", label: "Supplier Name", required: true, placeholder: "e.g. Apex Electronics Supply" },
        { key: "contact_name", label: "Contact Person", placeholder: "e.g. John Doe" },
        { key: "email", label: "Email", type: "email", placeholder: "john@supplier.com" },
        { key: "phone", label: "Phone", placeholder: "+1 (555) 123-4567" },
        { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "Street, City, State" },
      ]}
      columns={[
        { label: "Supplier", render: (s) => <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span> },
        { label: "Contact", render: (s) => <span className="text-slate-500">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" • ") || "—"}</span> },
        { label: "Total Purchases", align: "right", render: (s) => money(t(s.id).purchases) },
        { label: "Total Paid", align: "right", render: (s) => money(t(s.id).paid) },
        { label: "Outstanding Dues", align: "right", render: (s) => money(Math.max(0, t(s.id).purchases - t(s.id).paid)) },
        { label: "Status", render: (s) => dueStatus(Math.max(0, t(s.id).purchases - t(s.id).paid), t(s.id).purchases) },
      ]} />
  );
}
