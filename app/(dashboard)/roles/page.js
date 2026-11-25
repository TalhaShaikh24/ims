"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getSetting, logAudit, setSetting } from "@/lib/data";
import { useTable } from "@/lib/data";
import { Button, Card, CardHeader, PageHeader, SchemaBanner, useToast } from "@/components/ui";

const ROLES = ["Super Admin", "Organization Admin", "Manager", "Cashier", "Inventory Manager", "Accountant"];
const PERMS = ["Access POS Terminal", "Apply Discounts", "Process Refunds", "Manage Products", "Manage Inventory", "Manage Purchases", "Manage Cash Register", "View P&L Reports", "Manage Staff"];
const DEFAULTS = {
  "Super Admin": PERMS,
  "Organization Admin": PERMS,
  "Manager": PERMS.filter((p) => !["View P&L Reports", "Manage Staff"].includes(p)),
  "Cashier": ["Access POS Terminal", "Apply Discounts", "Process Refunds", "Manage Cash Register"],
  "Inventory Manager": ["Manage Products", "Manage Inventory", "Manage Purchases"],
  "Accountant": ["Manage Purchases", "Manage Cash Register", "View P&L Reports"],
};

export default function RolesPage() {
  const toast = useToast();
  const empQ = useTable("employees");
  const [matrix, setMatrix] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSetting("roles", null).then((v) => { if (v && typeof v === "object") setMatrix({ ...DEFAULTS, ...v }); setLoaded(true); }); }, []);
  const countFor = (role) => empQ.rows.filter((e) => e.role_name === role).length;

  function toggle(role, perm) {
    if (role === "Super Admin") return;
    setMatrix((m) => { const cur = new Set(m[role] || []); cur.has(perm) ? cur.delete(perm) : cur.add(perm); return { ...m, [role]: [...cur] }; });
  }
  async function save() {
    setSaving(true);
    try { await setSetting("roles", matrix); await logAudit("Update", "Roles & Permissions matrix updated"); toast("Permissions saved to Supabase (app_settings)."); }
    catch (e) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <div className="page-in">
      <PageHeader title="Roles & Permissions" sub="Control access to features and modules by role — saved in Supabase">
        <Button onClick={save} disabled={saving || !loaded}><ShieldCheck className="h-4 w-4" /> {saving ? "Saving…" : "Save Permissions"}</Button>
      </PageHeader>
      <SchemaBanner error={empQ.error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r} className="p-5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/5">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-white">{r}</h3><span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{countFor(r)} staff</span></div>
            <p className="mt-1.5 text-[13px] text-slate-500">{(matrix[r] || []).length} of {PERMS.length} permissions granted</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: ((matrix[r] || []).length / PERMS.length) * 100 + "%" }} /></div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Permissions Matrix" sub="Super Admin always has full access and cannot be changed" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40"><th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capability</th>{ROLES.map((r) => <th key={r} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">{r}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PERMS.map((p) => (
                <tr key={p} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{p}</td>
                  {ROLES.map((r) => {
                    const on = (matrix[r] || []).includes(p);
                    return <td key={r} className="px-3 py-3 text-center"><input type="checkbox" checked={on} disabled={r === "Super Admin"} onChange={() => toggle(r, p)} className="h-[18px] w-[18px] cursor-pointer accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-60" /></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3.5 text-[13px] text-slate-400 dark:border-slate-800">Changes are saved to Supabase and recorded in the audit trail.</p>
      </Card>
    </div>
  );
}
