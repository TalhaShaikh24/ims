import Shell from "@/components/Shell";

// Live Supabase data on every request — never statically prerender these pages.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }) {
  return <Shell>{children}</Shell>;
}
