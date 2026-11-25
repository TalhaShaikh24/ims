"use client";
import EntityManager from "@/components/EntityManager";
import { useBranch } from "@/components/Shell";
import { fmtDate, money } from "@/lib/utils";
import { Badge } from "@/components/ui";

const CATS = ["Rent & Utilities", "Inventory", "Salaries", "Marketing", "Maintenance", "Other"].map((c) => ({ value: c, label: c }));
const METHODS = ["Cash", "Bank Transfer", "Card", "Digital Wallet"].map((m) => ({ value: m, label: m }));

export default function ExpensesPage() {
  const { branchId } = useBranch();
  return (
    <EntityManager title="Expenses" sub="Track business expenses and operating costs" table="expenses" entityName="Expense" addLabel="Record Expense"
      searchKeys={["description", "category"]}
      filterRows={(rows) => branchId === "all" ? rows : rows.filter((e) => e.branch_id === branchId || e.branch_id == null)}
      formDefaults={{ description: "", category: "Other", amount: "", expense_date: new Date().toISOString().slice(0, 10), payment_method: "Cash", notes: "" }}
      transformSave={(v) => ({ ...v, branch_id: branchId !== "all" ? branchId : null })}
      fields={[
        { key: "description", label: "Description", required: true, placeholder: "e.g. Office Rent" },
        { key: "category", label: "Category", type: "select", options: CATS },
        { key: "amount", label: "Amount ($)", type: "number", required: true, placeholder: "0.00" },
        { key: "expense_date", label: "Date", type: "date" },
        { key: "payment_method", label: "Payment Method", type: "select", options: METHODS },
        { key: "notes", label: "Notes (optional)", type: "textarea", span: 2, placeholder: "Additional details…" },
      ]}
      columns={[
        { label: "Date", render: (e) => <span className="text-slate-500">{fmtDate(e.expense_date || e.created_at)}</span> },
        { label: "Description", render: (e) => <span className="font-medium text-slate-800 dark:text-slate-100">{e.description}</span> },
        { label: "Category", render: (e) => <Badge tone="slate">{e.category}</Badge> },
        { label: "Payment", render: (e) => e.payment_method || "Cash" },
        { label: "Amount", align: "right", render: (e) => money(e.amount) },
      ]} />
  );
}
