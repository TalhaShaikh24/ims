"use client";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit, useTable } from "@/lib/data";
import { Button, Card, DataTable, Field, Input, Modal, PageHeader, SchemaBanner, Select, Textarea, useToast } from "./ui";

/**
 * Config-driven CRUD page.
 * fields: [{ key, label, type: text|number|email|date|select|textarea, required, options, optionsFrom:{rows,label,value}, span }]
 * columns: DataTable columns. formDefaults: object. transformSave(values) optional.
 */
export default function EntityManager({ title, sub, table, entityName, columns, fields, formDefaults = {}, searchKeys = [], transformSave, afterSave, filterRows, addLabel }) {
  const toast = useToast();
  const { rows, loading, error, reload, schemaError } = useTable(table, (q) => q.order("created_at", { ascending: false }));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(formDefaults);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    let r = filterRows ? filterRows(rows) : rows;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((row) => searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(s)));
    }
    return r;
  }, [rows, search, filterRows, searchKeys]);

  function openAdd() { setEditing(null); setForm({ ...formDefaults }); setOpen(true); }
  function openEdit(row) {
    setEditing(row);
    const f = { ...formDefaults };
    fields.forEach((fld) => { f[fld.key] = row[fld.key] ?? ""; });
    setForm(f); setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return toast("Supabase is not configured — open the Setup page.", "error");
    setSaving(true);
    let values = { ...form };
    fields.forEach((f) => { if (f.type === "number") values[f.key] = values[f.key] === "" ? null : Number(values[f.key]); if (values[f.key] === "") values[f.key] = null; });
    if (transformSave) values = transformSave(values, editing);
    const { data, error: err } = editing
      ? await sb.from(table).update(values).eq("id", editing.id).select().single()
      : await sb.from(table).insert(values).select().single();
    setSaving(false);
    if (err) return toast(err.message, "error");
    await logAudit(editing ? "Update" : "Create", `${entityName}: ${data.name || data.description || data.invoice_no || data.po_no || data.id}`);
    if (afterSave) await afterSave(data, editing);
    toast(`${entityName} ${editing ? "updated" : "saved"} successfully.`);
    setOpen(false); reload();
  }

  async function remove(row) {
    if (!confirm(`Delete this ${entityName.toLowerCase()}? This cannot be undone.`)) return;
    const sb = supabase(); if (!sb) return;
    const { error: err } = await sb.from(table).delete().eq("id", row.id);
    if (err) return toast(err.message, "error");
    await logAudit("Delete", `${entityName}: ${row.name || row.description || row.id}`);
    toast(`${entityName} deleted.`);
    reload();
  }

  const cols = [...columns, {
    label: "Actions", align: "right",
    render: (r) => (
      <div className="flex justify-end gap-1">
        <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => remove(r)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
    ),
  }];

  return (
    <div className="page-in">
      <PageHeader title={title} sub={sub}>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${entityName.toLowerCase()}s…`} className="w-full pl-9" />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> {addLabel || `Add ${entityName}`}</Button>
      </PageHeader>
      <SchemaBanner error={error && !schemaError ? error : schemaError ? error : null} />
      <Card><DataTable columns={cols} rows={visible} loading={loading} /></Card>

      <Modal open={open} onClose={() => setOpen(false)} title={`${editing ? "Edit" : "Add"} ${entityName}`} sub={editing ? "Update the details below." : `Enter details to add a new ${entityName.toLowerCase()}.`}>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} required={f.required} className={f.span === 2 ? "sm:col-span-2" : ""}>
              {f.type === "select" ? (
                <Select value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required={f.required}>
                  <option value="">{f.placeholder || "Select…"}</option>
                  {(f.optionsFrom ? f.optionsFrom.rows.map((o) => ({ value: o[f.optionsFrom.value || "id"], label: o[f.optionsFrom.label || "name"] })) : (f.options || [])).map((o) => (
                    <option key={String(o.value)} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea rows={3} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} required={f.required} />
              ) : (
                <Input type={f.type || "text"} step={f.type === "number" ? "any" : undefined} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} required={f.required} />
              )}
            </Field>
          ))}
          <div className="mt-1 flex justify-end gap-3 border-t border-[#F1F5F9] pt-4 dark:border-slate-700 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Save Changes" : `Save ${entityName}`}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
