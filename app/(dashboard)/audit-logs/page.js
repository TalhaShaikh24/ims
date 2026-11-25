"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { useTable } from "@/lib/data";
import { downloadCSV, fmtDate } from "@/lib/utils";
import { Badge, Button, Card, DataTable, Input, PageHeader, SchemaBanner, Select } from "@/components/ui";

const TONE = { Create: "green", Update: "blue", Delete: "red", Sale: "indigo", Login: "slate" };

export default function AuditLogsPage() {
  const logsQ = useTable("audit_logs", (q) => q.order("created_at", { ascending: false }).limit(300));
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const today = new Date().toDateString();
  const rows = logsQ.rows.filter((l) => (action === "all" || l.action === action) && (l.user_name + " " + l.action + " " + (l.details || "")).toLowerCase().includes(search.toLowerCase()));
  const actions = [...new Set(logsQ.rows.map((l) => l.action))];

  function exportCsv() { downloadCSV("audit-logs.csv", [["Timestamp", "User", "Action", "Details"], ...rows.map((l) => [fmtDate(l.created_at, true), l.user_name || "", l.action, l.details || ""])]); }

  return (
    <div className="page-in">
      <PageHeader title="Audit Logs" sub="Every create, update, delete and sale in the system is recorded here">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, action or details…" className="w-72" />
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-40"><option value="all">All Actions</option>{actions.map((a) => <option key={a}>{a}</option>)}</Select>
        <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </PageHeader>
      <SchemaBanner error={logsQ.error} />
      <div className="mb-5 flex flex-wrap gap-4 text-sm text-slate-500">
        <span>Total logs: <strong className="text-slate-800 dark:text-slate-100">{logsQ.rows.length}</strong></span>
        <span>Today's activity: <strong className="text-slate-800 dark:text-slate-100">{logsQ.rows.filter((l) => new Date(l.created_at).toDateString() === today).length}</strong></span>
        <span>User actions: <strong className="text-slate-800 dark:text-slate-100">{logsQ.rows.filter((l) => l.user_name && l.user_name !== "System").length}</strong></span>
      </div>
      <Card>
        <DataTable rows={rows} loading={logsQ.loading} pageSize={12} columns={[
          { label: "Timestamp", render: (l) => <span className="text-slate-500">{fmtDate(l.created_at, true)}</span> },
          { label: "User", render: (l) => <span className="font-medium text-slate-800 dark:text-slate-100">{l.user_name || "System"}</span> },
          { label: "Action", render: (l) => <Badge tone={TONE[l.action] || "slate"}>{l.action}</Badge> },
          { label: "Details", render: (l) => <span className="text-slate-500">{l.details || "—"}</span> },
        ]} />
      </Card>
    </div>
  );
}
