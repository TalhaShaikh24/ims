"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, CloudCog, Database, RefreshCw, XCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/supabase";
import { useTable } from "@/lib/data";
import { Button, Card, CardHeader, Field, Input, PageHeader, StatCard, useToast } from "@/components/ui";

const TABLES = ["products", "customers", "suppliers", "sales", "sale_items", "expenses", "employees", "branches"];

export default function SetupPage() {
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const prodQ = useTable("products");
  const custQ = useTable("customers");
  const salesQ = useTable("sales");
  const cfg = getConfig();

  useEffect(() => { const c = getConfig(); setUrl(c.url || ""); setKey(""); }, []);

  async function test(u, k) {
    if (!u || !k) return setStatus({ ok: false, msg: "Enter both the project URL and the anon key." });
    setTesting(true);
    try {
      const client = createClient(u, k, { auth: { persistSession: false } });
      const { error } = await client.from("products").select("id").limit(1);
      if (error) setStatus({ ok: false, msg: error.message + (error.code ? ` (${error.code})` : "") });
      else setStatus({ ok: true, msg: "Connection successful — the products table responded." });
    } catch (e) { setStatus({ ok: false, msg: e.message }); }
    setTesting(false);
  }
  function save() {
    localStorage.setItem("xona_supa_url", url.trim());
    if (key.trim()) localStorage.setItem("xona_supa_key", key.trim());
    toast("Connection settings saved on this device. Reloading…");
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="page-in mx-auto max-w-3xl">
      <PageHeader title="Supabase Cloud Sync" sub="Connect this app to your Supabase project for live, shared data" />
      <div className={`mb-6 flex gap-3 rounded-xl border p-4 text-sm ${cfg.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
        {cfg.configured ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <CloudCog className="h-5 w-5 shrink-0" />}
        <p>{cfg.configured ? <><strong>Connected.</strong> Data is read and written live against {cfg.url}. Every page computes its totals from these tables.</> : <><strong>Not configured.</strong> Add your project URL and anon key below — or set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.</>}</p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Products" value={String(prodQ.rows.length)} sub="Live rows" icon={Database} tone="indigo" />
        <StatCard label="Customers" value={String(custQ.rows.length)} sub="Live rows" icon={Database} tone="sky" />
        <StatCard label="Invoices" value={String(salesQ.rows.length)} sub="Live rows" icon={Database} tone="emerald" />
        <StatCard label="Sync Tables" value={String(TABLES.length)} sub={TABLES.join(", ")} icon={CloudCog} tone="slate" />
      </div>
      <Card>
        <CardHeader title="Connection Settings" sub="From Supabase Dashboard → Settings → API" />
        <div className="space-y-4 px-6 py-5">
          <Field label="Supabase Project URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" /></Field>
          <Field label="Supabase Anon Key"><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={cfg.configured ? "•••••••••• (already saved — paste only to replace)" : "eyJhbGciOi…"} /></Field>
          {status && <p className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[13px] ${status.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" : "bg-red-50 text-red-600 dark:bg-red-500/10"}`}>{status.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}{status.msg}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Save & Reload</Button>
            <Button variant="secondary" onClick={() => test(url, key || getConfig().key)} disabled={testing}><RefreshCw className="h-4 w-4" /> {testing ? "Testing…" : "Test Connection"}</Button>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 pt-2 text-[13px] leading-relaxed text-slate-500">
            <li>Create a project at supabase.com and apply the schema from <code className="font-mono">supabase/migrations/</code> with <code className="font-mono">supabase db push</code>.</li>
            <li>Copy the Project URL and anon key from Settings → API.</li>
            <li>Paste them above and save — data syncs live from that moment.</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
