"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Lock, Mail, UserRound } from "lucide-react";
import { getConfig, supabase } from "@/lib/supabase";
import { USER_ROLES } from "@/lib/utils";
import { LogoLockup } from "@/components/Shell";

const inputCls = "h-11 w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[rgba(99,102,241,0.30)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Super Admin");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
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
    setError(""); setDone("");
    const sb = supabase();
    if (!sb) return setError("Supabase is not configured yet — open the Setup page from the app or set your .env.local values first.");
    setBusy(true);
    const { data, error: err } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
    if (err) { setBusy(false); return setError(err.message); }
    if (data.user) {
      const { error: pErr } = await sb.from("profiles").insert({ id: data.user.id, email: email.trim(), full_name: name.trim(), role_name: role });
      if (pErr && pErr.code !== "23505") return setError(`Account created, but the profile could not be saved: ${pErr.message}`);
      localStorage.setItem("xona_profile_name", name.trim());
      localStorage.setItem("xona_profile_email", email.trim());
    }
    setBusy(false);
    if (data.session) { router.replace("/"); router.refresh(); return; }
    setDone("Account created. If email confirmation is enabled for your project, confirm your email first — then sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 dark:bg-[#0B1120]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800">
        <LogoLockup />
        <h2 className="mt-7 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Create your account</h2>
        <p className="mt-1.5 text-sm text-slate-500">Set up your IMS workspace in a minute.</p>

        {!configured && (
          <div className="mt-6 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Supabase is not configured on this device yet. <Link href="/setup" className="font-semibold underline">Open the Setup page</Link> first — registration activates right after.</p>
          </div>
        )}
        {error && (
          <div className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] font-medium text-[#DC2626]">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {done && (
          <div className="mt-6 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-[13px] font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {done}
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Full Name</span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alexander Wright" className={inputCls} />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Email Address</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" className={inputCls} />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#1F2937] dark:text-slate-200">Role</span>
            <span className="relative block">
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-11 w-full appearance-none rounded-[10px] border border-[#E5E7EB] bg-white px-3 pr-9 text-sm text-slate-900 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[rgba(99,102,241,0.30)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
          <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center rounded-xl bg-[#4F46E5] text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-50">
            {busy ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-[#4F46E5] hover:text-[#4338CA]">Sign in</Link></p>
      </div>
    </div>
  );
}
