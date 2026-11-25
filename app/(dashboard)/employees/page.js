"use client";
import { useMemo } from "react";
import EntityManager from "@/components/EntityManager";
import { useTable } from "@/lib/data";
import { docNo, money, n } from "@/lib/utils";
import { Badge } from "@/components/ui";

const ROLES = ["Super Admin", "Organization Admin", "Manager", "Cashier", "Inventory Manager", "Accountant"].map((r) => ({ value: r, label: r }));

export default function EmployeesPage() {
  const branchQ = useTable("branches", (q) => q.order("name"));
  const branchName = useMemo(() => new Map(branchQ.rows.map((b) => [b.id, b.name])), [branchQ.rows]);
  return (
    <EntityManager title="Employees & Staff" sub="Manage staff, roles and payroll" table="employees" entityName="Employee" addLabel="Add New Employee"
      searchKeys={["name", "email", "role_name"]}
      formDefaults={{ name: "", email: "", role_name: "Cashier", branch_id: "", salary: "" }}
      fields={[
        { key: "name", label: "Full Name", required: true, placeholder: "e.g. Sarah Bennett" },
        { key: "email", label: "Email", type: "email", placeholder: "name@company.com" },
        { key: "role_name", label: "Role", type: "select", options: ROLES },
        { key: "branch_id", label: "Branch", type: "select", optionsFrom: { rows: branchQ.rows }, quickAdd: { label: "Branch", table: "branches", buildPayload: (name) => ({ name, code: docNo("BR") }), onCreated: () => branchQ.reload() } },
        { key: "salary", label: "Monthly Salary (PKR)", type: "number", placeholder: "0.00" },
      ]}
      columns={[
        { label: "Employee", render: (e) => (<div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-[13px] font-semibold text-indigo-600 dark:bg-indigo-500/10">{e.name.charAt(0)}</span><div><p className="font-medium text-slate-800 dark:text-slate-100">{e.name}</p><p className="text-xs text-slate-400">{e.email || ""}</p></div></div>) },
        { label: "Role", render: (e) => <Badge tone="indigo">{e.role_name}</Badge> },
        { label: "Branch", render: (e) => branchName.get(e.branch_id) || "—" },
        { label: "Salary", align: "right", render: (e) => money(e.salary) + "/mo" },
        { label: "Status", render: (e) => e.is_active === false ? <Badge tone="red">Inactive</Badge> : <Badge tone="green">Active</Badge> },
      ]} />
  );
}
