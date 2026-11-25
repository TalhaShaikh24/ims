import { createClient } from "@supabase/supabase-js";

let cached = null;
let cachedKey = "";

export function getConfig() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  let url = envUrl, key = envKey;
  if (typeof window !== "undefined") {
    url = localStorage.getItem("xona_supa_url") || envUrl;
    key = localStorage.getItem("xona_supa_key") || envKey;
  }
  return { url, key, configured: Boolean(url && key) };
}

export function supabase() {
  const { url, key, configured } = getConfig();
  if (!configured) return null;
  const sig = url + "|" + key;
  if (!cached || cachedKey !== sig) {
    cached = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    cachedKey = sig;
  }
  return cached;
}

export function isSchemaError(error) {
  if (!error) return false;
  const code = error.code || "";
  const msg = (error.message || "") + (error.hint || "");
  return code === "PGRST205" || code === "42P01" || code === "42501" || /permission denied|does not exist|schema cache/i.test(msg);
}
