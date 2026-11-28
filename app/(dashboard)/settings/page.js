"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSetting, logAudit, setSetting } from "@/lib/data";
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea, useToast } from "@/components/ui";

function Toggle({ label, sub, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>{sub && <p className="text-[13px] text-slate-400">{sub}</p>}</div>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [org, setOrg] = useState({ business_name: "IMS", currency: "PKR", tax_rate: 8.5, timezone: "Asia/Karachi", email: "", phone: "", address: "" });
  const [receipt, setReceipt] = useState({ header: "", footer: "", sale_policy: "", instructions: "", show_logo: true, show_tax: true, show_cashier: true });
  const [profile, setProfile] = useState({ name: "Admin", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting("org", null).then((v) => v && setOrg((o) => ({ ...o, ...v })));
    getSetting("receipt", null).then((v) => v && setReceipt((r) => ({ ...r, ...v })));
    setProfile({ name: localStorage.getItem("xona_profile_name") || "Admin", email: localStorage.getItem("xona_profile_email") || "", phone: localStorage.getItem("xona_profile_phone") || "" });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setSetting("org", { ...org, tax_rate: Number(org.tax_rate) || 0 });
      await setSetting("receipt", receipt);
      localStorage.setItem("xona_profile_name", profile.name);
      localStorage.setItem("xona_profile_email", profile.email);
      localStorage.setItem("xona_profile_phone", profile.phone);
      await logAudit("Update", "Settings & branding updated");
      toast("Settings saved to Supabase.");
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  }

  return (
    <div className="page-in mx-auto max-w-[960px]">
      <PageHeader title="Settings & Branding" sub="Configure your organization, receipts and profile">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}</Button>
      </PageHeader>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Organization Profile" sub="Used across invoices, POS tax and reports" />
          <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
            <Field label="Business Name"><Input value={org.business_name} onChange={(e) => setOrg({ ...org, business_name: e.target.value })} /></Field>
            <Field label="Currency"><Select value={org.currency} onChange={(e) => setOrg({ ...org, currency: e.target.value })}><option value="PKR">PKR (₨)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="INR">INR (₹)</option></Select></Field>
            <Field label="Tax Rate (%)"><Input type="number" step="any" value={org.tax_rate} onChange={(e) => setOrg({ ...org, tax_rate: e.target.value })} /></Field>
            <Field label="Timezone"><Select value={org.timezone} onChange={(e) => setOrg({ ...org, timezone: e.target.value })}><option>America/New_York</option><option>America/Chicago</option><option>America/Los_Angeles</option><option>Europe/London</option><option>Asia/Karachi</option><option>Asia/Kolkata</option><option>Asia/Dubai</option></Select></Field>
            <Field label="Contact Email"><Input type="email" value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} /></Field>
            <Field label="Contact Phone"><Input value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Textarea rows={2} value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Receipt Settings" sub="Printed on every invoice receipt" />
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Header Text"><Input value={receipt.header || ""} onChange={(e) => setReceipt({ ...receipt, header: e.target.value })} placeholder="Thank you for shopping with us!" /></Field>
              <Field label="Footer Text"><Input value={receipt.footer || ""} onChange={(e) => setReceipt({ ...receipt, footer: e.target.value })} placeholder="Please visit again!" /></Field>
              <Field label="Sale Policy"><Input value={receipt.sale_policy || ""} onChange={(e) => setReceipt({ ...receipt, sale_policy: e.target.value })} placeholder="e.g. Bill must be paid within 01 week." /></Field>
              <Field label="Instructions"><Input value={receipt.instructions || ""} onChange={(e) => setReceipt({ ...receipt, instructions: e.target.value })} placeholder="e.g. Checking warranty 02 days only." /></Field>
            </div>
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              <Toggle label="Show Business Logo" value={receipt.show_logo !== false} onChange={(v) => setReceipt({ ...receipt, show_logo: v })} />
              <Toggle label="Show Tax Breakdown" value={receipt.show_tax !== false} onChange={(v) => setReceipt({ ...receipt, show_tax: v })} />
              <Toggle label="Show Cashier Name" value={receipt.show_cashier !== false} onChange={(v) => setReceipt({ ...receipt, show_cashier: v })} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="My Profile" sub="Shown as the cashier on sales and in audit logs (stored on this device)" />
          <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-3">
            <Field label="Full Name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          </div>
        </Card>
        <Card className="border-red-200 dark:border-red-500/30">
          <CardHeader title="Danger Zone" sub="Irreversible actions" />
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
            <p className="flex max-w-md items-start gap-2 text-sm text-slate-500"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> Resetting clears sales, items, movements, returns and audit logs from Supabase. Products, customers and settings stay.</p>
            <Button variant="danger" onClick={async () => {
              if (!confirm("Delete ALL sales, returns, movements and audit logs? This cannot be undone.")) return;
              const sb = supabase(); if (!sb) return;
              for (const t of ["sales_returns", "sale_items", "sales", "stock_movements", "audit_logs"]) await sb.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
              toast("Transactional data cleared.", "warn");
            }}>Reset Transactional Data</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
