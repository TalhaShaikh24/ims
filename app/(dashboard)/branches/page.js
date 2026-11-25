"use client";
import EntityManager from "@/components/EntityManager";
import { Badge } from "@/components/ui";

export default function BranchesPage() {
  return (
    <EntityManager title="Branch Locations" sub="Manage your store locations — the topbar switcher filters data by branch" table="branches" entityName="Branch" addLabel="Add New Branch"
      searchKeys={["name", "code", "address"]}
      formDefaults={{ code: "", name: "", address: "", phone: "", manager_name: "", is_main: false }}
      transformSave={(v) => ({ ...v, is_main: v.is_main === true || v.is_main === "true" })}
      fields={[
        { key: "name", label: "Branch Name", required: true, placeholder: "e.g. Main Flagship Store (Downtown)" },
        { key: "code", label: "Branch Code", required: true, placeholder: "e.g. BR-MAIN" },
        { key: "phone", label: "Phone", placeholder: "+1 (555) 123-4567" },
        { key: "manager_name", label: "Manager", placeholder: "e.g. Sarah Bennett" },
        { key: "address", label: "Address", type: "textarea", span: 2, placeholder: "123 Main Street, City, State" },
      ]}
      columns={[
        { label: "Branch", render: (b) => (<div><p className="font-medium text-slate-800 dark:text-slate-100">{b.name}</p><p className="font-mono text-xs text-slate-400">{b.code}</p></div>) },
        { label: "Address", render: (b) => <span className="text-slate-500">{b.address || "—"}</span> },
        { label: "Phone", render: (b) => b.phone || "—" },
        { label: "Manager", render: (b) => b.manager_name || "—" },
        { label: "Type", render: (b) => b.is_main ? <Badge tone="indigo">Main Branch</Badge> : <Badge tone="slate">Sub Branch</Badge> },
        { label: "Status", render: (b) => b.is_active === false ? <Badge tone="red">Inactive</Badge> : <Badge tone="green">Active</Badge> },
      ]} />
  );
}
