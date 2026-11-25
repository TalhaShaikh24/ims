"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, isSchemaError } from "./supabase";

export function useTable(table, build) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabase();
      if (!sb) { if (alive) { setError({ notConfigured: true }); setLoading(false); } return; }
      setLoading(true);
      let q = sb.from(table).select("*");
      if (build) q = build(q);
      const { data, error: err } = await q;
      if (!alive) return;
      if (err) setError(err); else { setRows(data || []); setError(null); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [table, tick]); // build is intentionally static per page

  return { rows, loading, error, reload, schemaError: isSchemaError(error) };
}

export async function logAudit(action, details) {
  try {
    const sb = supabase();
    if (!sb) return;
    const user_name = (typeof window !== "undefined" && localStorage.getItem("xona_profile_name")) || "Admin";
    await sb.from("audit_logs").insert({ user_name, action, details });
  } catch { /* audit must never break the main flow */ }
}

/** Fetch the profiles row for a Supabase Auth user id (null when missing/unconfigured). */
export async function fetchProfile(userId) {
  const sb = supabase();
  if (!sb || !userId) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return null;
  return data || null;
}

/** Profile of the currently signed-in user, or null. */
export async function getCurrentProfile() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data?.user) return null;
  return fetchProfile(data.user.id);
}

export async function getSetting(key, fallback) {
  const sb = supabase();
  if (!sb) return fallback;
  const { data } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}
export async function setSetting(key, value) {
  const sb = supabase();
  if (!sb) throw new Error("Supabase is not configured");
  const { error } = await sb.from("app_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}
