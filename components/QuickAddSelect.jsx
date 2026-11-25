"use client";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/data";
import { Button, Field, Input, Select, useToast } from "./ui";

export default function QuickAddSelect({
  label,
  required,
  className,
  value,
  onChange,
  placeholder = "Select…",
  options = [],
  entityLabel = "Item",
  table,
  buildPayload,
  onCreated,
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const sb = supabase();
    if (!sb) return toast("Database is not configured.", "error");
    setSaving(true);
    const payload = buildPayload ? buildPayload(trimmed) : { name: trimmed };
    const { data, error } = await sb.from(table).insert(payload).select().single();
    setSaving(false);
    if (error) return toast(error.message, "error");
    await logAudit("Create", `${entityLabel}: ${data.name || trimmed}`);
    toast(`${entityLabel} "${trimmed}" added.`);
    setName("");
    setAdding(false);
    if (onCreated) await onCreated(data);
    if (onChange && data?.id) onChange(data.id, data);
  }

  return (
    <Field
      label={label}
      required={required}
      className={className}
      action={
        table ? (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {adding ? "Close" : `Add New ${entityLabel}`}
          </button>
        ) : null
      }
    >
      {adding && (
        <div className="dropdown-in mb-2 flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-blue-50/50 p-1.5 dark:border-blue-500/30 dark:bg-blue-500/10">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleCreate();
              }
            }}
            placeholder={`New ${entityLabel.toLowerCase()} name…`}
            className="h-8 flex-1 text-[12.5px]"
            autoFocus
          />
          <Button type="button" size="sm" onClick={handleCreate} disabled={saving || !name.trim()} className="h-8 px-2.5">
            <Check className="h-3.5 w-3.5" /> {saving ? "…" : "Add"}
          </Button>
        </div>
      )}
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </Field>
  );
}
