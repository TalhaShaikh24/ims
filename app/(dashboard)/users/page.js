"use client";
import { useMemo, useState } from "react";
import { Check, Info, Pencil, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { fmtDate, USER_ROLES } from "@/lib/utils";
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

function Toggle({ value, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-[#4F46E5]" : "bg-slate-200 dark:bg-slate-600")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", value ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const profQ = useTable("profiles", (q) => q.order("created_at", { ascending: false }));
  const branchQ = useTable("branches", (q) => q.order("name"));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", role_name: "Cashier", branch_id: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const branchName = useMemo(() => new Map(branchQ.rows.map((b) => [b.id, b.name])), [branchQ.rows]);
  const rows = useMemo(() => {
    if (!search) return profQ.rows;
    const s = search.toLowerCase();
    return profQ.rows.filter((p) => `${p.full_name || ""} ${p.email || ""} ${p.role_name || ""}`.toLowerCase().includes(s));
  }, [profQ.rows, search]);

  function openAdd() { setEditing(null); setForm({ full_name: "", email: "", role_name: "Cashier", branch_id: "", is_active: true }); setOpen(true); }
  function openEdit(p) {
    setEditing(p);
    setForm({ full_name: p.full_name || "", email: p.email || "", role_name: p.role_name || "Cashier", branch_id: p.branch_id || "", is_active: p.is_active !== false });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured — open the Setup page.", "error");
    setSaving(true);
    const values = { full_name: form.full_name.trim(), email: form.email.trim(), role_name: form.role_name, branch_id: form.branch_id || null, is_active: form.is_active };
    const { data, error } = editing
      ? await sb.from("profiles").update(values).eq("id", editing.id).select().single()
      : await sb.from("profiles").insert(values).select().single();
    setSaving(false);
    if (error) return toast(error.message, "error");
    await logAudit(editing ? "Update" : "Create", `User profile: ${data.full_name || data.email} (${data.role_name})`);
    toast(`User ${editing ? "updated" : "added"} successfully.`);
    setOpen(false); profQ.reload();
  }

  return (
    <div className="page-in">
      <PageHeader title="Users & Access" sub="Manage team profiles, roles and access status">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="w-full pl-9" />
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> Add User Profile</Button>
      </PageHeader>
      <SchemaBanner error={profQ.error} />
      <p className="mb-5 flex max-w-3xl items-start gap-2 text-[13px] leading-relaxed text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Login accounts are created from the Register page (Supabase Auth). This page manages the matching profiles — names, roles, branch assignment and who is active.
      </p>
      <Card>
        <DataTable rows={rows} loading={profQ.loading} columns={[
          { label: "User", render: (p) => (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-[13px] font-bold text-white">{(p.full_name || p.email || "?").trim().charAt(0).toUpperCase()}</span>
              <div className="min-w-0"><p className="truncate font-semibold text-slate-800 dark:text-slate-100">{p.full_name || "—"}</p><p className="truncate text-xs text-slate-400">{p.email}</p></div>
            </div>
          ) },
          { label: "Role", render: (p) => <Badge tone="indigo">{p.role_name}</Badge> },
          { label: "Branch", render: (p) => branchName.get(p.branch_id) || "—" },
          { label: "Status", render: (p) => p.is_active !== false ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge> },
          { label: "Created", render: (p) => <span className="text-slate-500">{fmtDate(p.created_at)}</span> },
          { label: "Actions", align: "right", render: (p) => (
            <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:hover:bg-slate-700" aria-label="Edit user"><Pencil className="h-4 w-4" /></button>
          ) },
        ]} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit User" : "Add User Profile"} sub={editing ? "Update this user's profile, role and access." : "Create a profile. The login itself is created from the Register page."}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" required><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Sarah Bennett" required /></Field>
          <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" required /></Field>
          <Field label="Role" required>
            <Select value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} required>
              {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">No branch assigned</option>
              {branchQ.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 dark:border-slate-600 dark:bg-slate-700/40 sm:col-span-2">
            <div><p className="text-[13px] font-semibold text-[#1F2937] dark:text-slate-100">Active</p><p className="text-xs text-slate-400">Inactive users keep their history but lose access.</p></div>
            <Toggle value={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
          <div className="mt-1 flex justify-end gap-3 border-t border-[#F1F5F9] pt-4 dark:border-slate-700 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Save Changes" : "Save User"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
