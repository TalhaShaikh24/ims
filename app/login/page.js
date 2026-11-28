"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Boxes, CheckCircle2, Lock, Mail, Receipt } from "lucide-react";
import { getConfig, supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/data";
import { LogoLockup } from "@/components/Shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const cfg = getConfig();
    setConfigured(cfg.configured);
    if (!cfg.configured) return;
    const sb = supabase();
    sb?.auth.getSession().then(({ data }) => { if (data?.session) router.replace("/"); });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const sb = supabase();
    if (!sb) return setError("Supabase is not configured yet — open the Setup page from the app or set your .env.local values first.");
    setBusy(true);
    const { data, error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setBusy(false); return setError(err.message); }
    const p = await fetchProfile(data.user.id);
    if (p?.full_name) localStorage.setItem("xona_profile_name", p.full_name);
    localStorage.setItem("xona_profile_email", data.user.email || email.trim());
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-12 text-white lg:flex">
        <LogoLockup light />
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Run your business,<br />beautifully.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">Point of sale, inventory, purchases and financials — one clean workspace, powered by your Supabase data. Every number computed live, nothing hardcoded.</p>
          <ul className="mt-8 space-y-3.5 text-sm font-medium">
            {[[Receipt, "Fast POS billing with instant receipts"], [Boxes, "Live inventory, low-stock alerts & transfers"], [BarChart3, "Profit & loss and reports that always reconcile"]].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/20"><Icon className="h-4 w-4" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> IMS Business OS • By Talha Shaikh (talhashaikh.com • +923053591906)</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-white p-6 dark:bg-[#0B1120]">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden"><LogoLockup /></div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to your IMS workspace to continue.</p>

          {!configured && (
            <div className="mt-6 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Supabase is not configured on this device yet. <Link href="/setup" className="font-semibold underline">Open the Setup page</Link> to add your project URL and anon key — sign-in activates right after.</p>
            </div>
          )}
          {error && (
            <div className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] font-medium text-[#DC2626]">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Email Address</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11 w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[rgba(99,102,241,0.30)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[rgba(99,102,241,0.30)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
              </span>
            </label>
            <button type="submit" disabled={busy} className="flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">New to IMS? <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">Create an account</Link></p>
          <p className="mt-4 text-center text-[11px] text-slate-400">Software by <a href="https://talhashaikh.com" target="_blank" rel="noreferrer" className="font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300">Talha Shaikh</a> • talhashaikh.com • +923053591906</p>
        </div>
      </div>
    </div>
  );
}
