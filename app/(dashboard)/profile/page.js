"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/data";
import { fmtDate } from "@/lib/utils";
import { useAuth, useBranch } from "@/components/Shell";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, useToast } from "@/components/ui";

export default function ProfilePage() {
  const toast = useToast();
  const { user, profile, signOut } = useAuth();
  const { branches } = useBranch();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile]);

  const email = user?.email || profile?.email || "";
  const displayName = profile?.full_name || name || email || "Admin";
  const branchName = branches.find((b) => b.id === profile?.branch_id)?.name;

  async function save(e) {
    e.preventDefault();
    const sb = supabase(); if (!sb || !user) return toast("Sign in first to edit your profile.", "error");
    setSaving(true);
    const { error } = await sb.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) return toast(error.message, "error");
    localStorage.setItem("xona_profile_name", name.trim());
    await logAudit("Update", "Own profile name updated");
    toast("Profile saved. It will refresh across the app on next load.");
  }

  return (
    <div className="page-in mx-auto max-w-[720px]">
      <PageHeader title="My Profile" sub="Your account details for this workspace" />
      <Card>
        <CardHeader title="Profile Information" sub="From Supabase Auth and your profiles record" />
        <div className="px-6 py-5">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-xl font-bold text-white">{(displayName || "A").trim().charAt(0).toUpperCase()}</span>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-white">{displayName}</p>
              <p className="text-[13px] text-slate-400">{email || "Not signed in"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile?.role_name && <Badge tone="indigo">{profile.role_name}</Badge>}
                {profile && (profile.is_active !== false ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>)}
              </div>
            </div>
          </div>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></Field>
            <Field label="Email Address"><Input value={email} disabled className="opacity-60" /></Field>
            <Field label="Branch"><Input value={branchName || "—"} disabled className="opacity-60" /></Field>
            <Field label="Member Since"><Input value={profile?.created_at ? fmtDate(profile.created_at) : "—"} disabled className="opacity-60" /></Field>
            <div className="mt-1 flex flex-wrap justify-end gap-3 border-t border-[#F1F5F9] pt-4 dark:border-slate-700 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /> Sign Out</Button>
              <Button type="submit" disabled={saving || !user}><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save Changes"}</Button>
            </div>
          </form>
          {!user && <p className="mt-4 text-[13px] text-slate-400">You are browsing without a session (demo/setup mode). <Link href="/login" className="font-semibold text-[#4F46E5]">Sign in</Link> to manage your profile.</p>}
        </div>
      </Card>
    </div>
  );
}
