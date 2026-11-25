"use client";
import { useMemo } from "react";
import EntityManager from "@/components/EntityManager";
import { useTable } from "@/lib/data";
import { money, n } from "@/lib/utils";
import { Badge } from "@/components/ui";

export default function CustomersPage() {
  const salesQ = useTable("sales");
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

  return (
    <EntityManager title="Customers & Credit" sub="Customer profiles, credit limits and outstanding balances — totals computed from sales" table="customers" entityName="Customer" addLabel="Add New Customer"
      searchKeys={["name", "email", "phone"]}
      formDefaults={{ name: "", email: "", phone: "", address: "", credit_limit: "" }}
      fields={[
        { key: "name", label: "Full Name", required: true, placeholder: "e.g. John Smith" },
        { key: "email", label: "Email", type: "email", placeholder: "john@example.com" },
        { key: "phone", label: "Phone", placeholder: "+1 (555) 123-4567" },
        { key: "credit_limit", label: "Credit Limit ($)", type: "number", placeholder: "0.00" },
        { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "123 Main St, City, State" },
      ]}
      columns={[
        { label: "Customer", render: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span> },
        { label: "Contact", render: (c) => <span className="text-slate-500">{[c.email, c.phone].filter(Boolean).join(" • ") || "—"}</span> },
        { label: "Total Purchases", align: "right", render: (c) => money(t(c.id).purchases) },
        { label: "Outstanding", align: "right", render: (c) => money(Math.max(0, t(c.id).purchases - t(c.id).paid)) },
        { label: "Credit Limit", align: "right", render: (c) => money(c.credit_limit) },
        { label: "Status", render: (c) => { const due = Math.max(0, t(c.id).purchases - t(c.id).paid); return due > 0 && n(c.credit_limit) > 0 && due > n(c.credit_limit) ? <Badge tone="red">Over Limit</Badge> : <Badge tone="green">Active</Badge>; } },
      ]} />
  );
}
