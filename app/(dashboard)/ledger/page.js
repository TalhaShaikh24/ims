"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Copy, Download, Mail, MessageCircle, Printer, Search } from "lucide-react";
import { getSetting, useTable } from "@/lib/data";
import { dateRange, downloadCSV, fmtDate, inRange, money, n, round2 } from "@/lib/utils";
import { useBranch } from "@/components/Shell";
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, SchemaBanner, Select, StatCard, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

const TABS = [
  ["customer", "Customer Ledger"],
  ["supplier", "Supplier Ledger"],
  ["walkin", "Walk-in Customers"],
];

const PRESETS = [
  ["today", "Today"],
  ["7d", "Last 7 Days"],
  ["30d", "Last 30 Days"],
  ["month", "This Month"],
  ["all", "All Time"],
];

export default function GeneralLedgerPage() {
  const toast = useToast();
  const { branchId, branch } = useBranch();
  const [tab, setTab] = useState("customer");
  const [partyId, setPartyId] = useState("all");
  const [preset, setPreset] = useState("30d");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [org, setOrg] = useState({ business_name: "IMS" });
  const [ledger, setLedger] = useState({ customer_advances: {}, supplier_advances: {}, entries: [] });

  const custQ = useTable("customers", (q) => q.order("name"));
  const supQ = useTable("suppliers", (q) => q.order("name"));
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: true }));
  const retQ = useTable("sales_returns", (q) => q.order("created_at", { ascending: true }));
  const poQ = useTable("purchases", (q) => q.order("created_at", { ascending: true }));
  const poRetQ = useTable("purchase_returns", (q) => q.order("created_at", { ascending: true }));

  useEffect(() => {
    getSetting("org", { business_name: "IMS" }).then((v) => v && setOrg(v));
    getSetting("party_ledger", { customer_advances: {}, supplier_advances: {}, entries: [] }).then((v) => {
      if (v && typeof v === "object") setLedger({ customer_advances: v.customer_advances || {}, supplier_advances: v.supplier_advances || {}, entries: Array.isArray(v.entries) ? v.entries : [] });
    });
  }, []);

  const custMap = useMemo(() => new Map(custQ.rows.map((c) => [c.id, c])), [custQ.rows]);
  const supMap = useMemo(() => new Map(supQ.rows.map((s) => [s.id, s])), [supQ.rows]);
  const saleMap = useMemo(() => new Map(salesQ.rows.map((s) => [s.id, s])), [salesQ.rows]);
  const poMap = useMemo(() => new Map(poQ.rows.map((p) => [p.id, p])), [poQ.rows]);

  const selectedParty = tab === "customer" && partyId !== "all"
    ? custMap.get(partyId)
    : tab === "supplier" && partyId !== "all"
      ? supMap.get(partyId)
      : null;

  const { rows, totalDebit, totalCredit, netBalance, totalAdvance } = useMemo(() => {
    const range = dateRange(preset);
    const byBranch = (r) => branchId === "all" || r.branch_id === branchId || r.branch_id == null;
    let list = [];

    if (tab === "customer") {
      salesQ.rows
        .filter((s) => s.customer_id && byBranch(s) && (partyId === "all" || s.customer_id === partyId))
        .forEach((s) => {
          list.push({
            id: `sale-${s.id}`,
            date: s.created_at,
            ref: s.invoice_no,
            party: custMap.get(s.customer_id)?.name || "Customer",
            kind: "invoice",
            typeLabel: `Sale Invoice (${s.payment_method})`,
            debit: round2(n(s.total)),
            credit: round2(n(s.amount_paid)),
            note: s.status,
          });
        });

      retQ.rows
        .filter((r) => r.customer_id && (partyId === "all" || r.customer_id === partyId))
        .forEach((r) => {
          list.push({
            id: `sret-${r.id}`,
            date: r.created_at,
            ref: r.return_no,
            party: custMap.get(r.customer_id)?.name || "Customer",
            kind: "return",
            typeLabel: "Sales Return",
            debit: 0,
            credit: round2(n(r.amount)),
            note: r.reason || "",
          });
        });

      ledger.entries
        .filter((e) => e.party_type === "customer" && n(e.advance_added) > 0 && (partyId === "all" || e.party_id === partyId))
        .forEach((e) => {
          list.push({
            id: `adv-${e.id}`,
            date: e.created_at,
            ref: "ADV-RCV",
            party: e.party_name || custMap.get(e.party_id)?.name || "Customer",
            kind: "advance",
            typeLabel: `Advance Receipt (${e.method})`,
            debit: 0,
            credit: round2(n(e.advance_added)),
            note: e.note || "Customer Advance",
          });
        });
    } else if (tab === "supplier") {
      poQ.rows
        .filter((p) => p.supplier_id && byBranch(p) && (partyId === "all" || p.supplier_id === partyId))
        .forEach((p) => {
          list.push({
            id: `po-${p.id}`,
            date: p.order_date || p.created_at,
            ref: p.po_no,
            party: supMap.get(p.supplier_id)?.name || "Supplier",
            kind: "invoice",
            typeLabel: `Purchase Order (${p.status})`,
            debit: round2(n(p.amount_paid)),
            credit: round2(n(p.total)),
            note: p.status,
          });
        });

      poRetQ.rows
        .filter((r) => {
          const po = poMap.get(r.purchase_id);
          return po && (partyId === "all" || po.supplier_id === partyId);
        })
        .forEach((r) => {
          const po = poMap.get(r.purchase_id);
          list.push({
            id: `pret-${r.id}`,
            date: r.created_at,
            ref: r.return_no,
            party: supMap.get(po?.supplier_id)?.name || "Supplier",
            kind: "return",
            typeLabel: "Purchase Return",
            debit: round2(n(r.amount)),
            credit: 0,
            note: r.reason || "",
          });
        });

      ledger.entries
        .filter((e) => e.party_type === "supplier" && n(e.advance_added) > 0 && (partyId === "all" || e.party_id === partyId))
        .forEach((e) => {
          list.push({
            id: `sadv-${e.id}`,
            date: e.created_at,
            ref: "ADV-PAY",
            party: e.party_name || supMap.get(e.party_id)?.name || "Supplier",
            kind: "advance",
            typeLabel: `Advance Paid (${e.method})`,
            debit: round2(n(e.advance_added)),
            credit: 0,
            note: e.note || "Supplier Advance",
          });
        });
    } else {
      salesQ.rows
        .filter((s) => !s.customer_id && byBranch(s))
        .forEach((s) => {
          list.push({
            id: `walk-${s.id}`,
            date: s.created_at,
            ref: s.invoice_no,
            party: "Walk-in Customer",
            kind: "invoice",
            typeLabel: `Walk-in Sale (${s.payment_method})`,
            debit: round2(n(s.total)),
            credit: round2(n(s.amount_paid)),
            note: s.status,
          });
        });

      retQ.rows
        .filter((r) => !r.customer_id && !saleMap.get(r.sale_id)?.customer_id)
        .forEach((r) => {
          list.push({
            id: `wret-${r.id}`,
            date: r.created_at,
            ref: r.return_no,
            party: "Walk-in Customer",
            kind: "return",
            typeLabel: "Walk-in Return",
            debit: 0,
            credit: round2(n(r.amount)),
            note: r.reason || "",
          });
        });
    }

    list = list
      .filter((x) => preset === "all" || inRange(x.date, range))
      .filter((x) => typeFilter === "all" || x.kind === typeFilter)
      .filter((x) => !search.trim() || (x.ref + " " + x.party + " " + x.typeLabel + " " + x.note).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const withBal = list.map((x) => {
      running = tab === "supplier" ? round2(running + x.credit - x.debit) : round2(running + x.debit - x.credit);
      return { ...x, balance: running };
    });

    const td = round2(withBal.reduce((a, x) => a + x.debit, 0));
    const tc = round2(withBal.reduce((a, x) => a + x.credit, 0));
    const adv = tab === "customer"
      ? (partyId === "all"
        ? Object.values(ledger.customer_advances || {}).reduce((a, v) => round2(a + n(v)), 0)
        : round2(n(ledger.customer_advances?.[partyId])))
      : tab === "supplier"
        ? (partyId === "all"
          ? Object.values(ledger.supplier_advances || {}).reduce((a, v) => round2(a + n(v)), 0)
          : round2(n(ledger.supplier_advances?.[partyId])))
        : 0;

    return {
      rows: withBal,
      totalDebit: td,
      totalCredit: tc,
      netBalance: tab === "supplier" ? round2(tc - td) : round2(td - tc),
      totalAdvance: adv,
    };
  }, [tab, partyId, preset, typeFilter, search, branchId, salesQ.rows, retQ.rows, poQ.rows, poRetQ.rows, ledger, custMap, supMap, saleMap, poMap]);

  function buildShareText() {
    const title = tab === "customer" ? "Customer Ledger Statement" : tab === "supplier" ? "Supplier Ledger Statement" : "Walk-in Customers Statement";
    const partyLabel = selectedParty?.name || (tab === "walkin" ? "Walk-in Customers" : "All Parties");
    const periodLabel = PRESETS.find(([v]) => v === preset)?.[1] || "All Time";
    const balLabel = netBalance > 0
      ? `Net Due: ${money(netBalance)}`
      : netBalance < 0
        ? `Advance Balance: ${money(Math.abs(netBalance))}`
        : "Balance: Settled (PKR 0.00)";
    const recent = rows.slice(-8).map((r) => `• ${fmtDate(r.date)} | ${r.ref} | Dr: ${money(r.debit)} | Cr: ${money(r.credit)}`).join("\n");
    return `${org.business_name || "IMS"} — ${title}\nParty: ${partyLabel}\nPeriod: ${periodLabel}\nTotal Debit: ${money(totalDebit)}\nTotal Credit: ${money(totalCredit)}\n${balLabel}${recent ? `\n\nRecent Entries:\n${recent}` : ""}`;
  }

  function shareWhatsApp() {
    const rawPhone = (selectedParty?.phone || "").replace(/[^\d]/g, "");
    const text = encodeURIComponent(buildShareText());
    const url = rawPhone ? `https://wa.me/${rawPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareEmail() {
    const to = selectedParty?.email || "";
    const subject = encodeURIComponent(`${org.business_name || "IMS"} — ${TABS.find(([v]) => v === tab)?.[1]} (${selectedParty?.name || "Statement"})`);
    const body = encodeURIComponent(buildShareText());
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function copyStatement() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast("Ledger statement copied to clipboard.");
    } catch {
      toast("Could not copy statement.", "error");
    }
  }

  function exportCsv() {
    downloadCSV(`ledger-${tab}.csv`, [
      ["Date", "Reference", "Party", "Type", "Debit", "Credit", "Running Balance", "Note"],
      ...rows.map((r) => [fmtDate(r.date, true), r.ref, r.party, r.typeLabel, r.debit.toFixed(2), r.credit.toFixed(2), r.balance.toFixed(2), r.note]),
    ]);
  }

  const loading = salesQ.loading || poQ.loading || custQ.loading || supQ.loading;

  return (
    <div className="page-in">
      <div className="no-print">
        <PageHeader title="General Ledger" sub="Separate Customer, Supplier & Walk-in statements — A4 Portrait printable & shareable">
          <Button variant="secondary" size="sm" onClick={copyStatement}><Copy className="h-3.5 w-3.5" /> Copy</Button>
          <Button variant="secondary" size="sm" onClick={shareWhatsApp} className="text-emerald-700 dark:text-emerald-400"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
          <Button variant="secondary" size="sm" onClick={shareEmail}><Mail className="h-3.5 w-3.5" /> Email</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print A4</Button>
        </PageHeader>
        <SchemaBanner error={salesQ.error || poQ.error} />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {TABS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setTab(v); setPartyId("all"); }}
              className={cn(
                "rounded-lg px-3.5 py-2 text-[13px] font-semibold transition",
                tab === v
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {tab !== "walkin" && (
            <Select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="w-full sm:w-56">
              <option value="all">{tab === "customer" ? "All Customers" : "All Suppliers"}</option>
              {(tab === "customer" ? custQ.rows : supQ.rows).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-[calc(50%-5px)] sm:w-40">
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-[calc(50%-5px)] sm:w-40">
            <option value="all">All Entries</option>
            <option value="invoice">{tab === "supplier" ? "Purchase Orders" : "Sales Invoices"}</option>
            <option value="advance">Advances</option>
            <option value="return">Returns</option>
          </Select>
          <div className="relative w-full sm:min-w-[200px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, party, note…" className="w-full pl-9" />
          </div>
        </div>
      </div>

      <div className="print-area print-a4-portrait">
        <div className="mb-4 hidden border-b border-slate-200 pb-3 print:block">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{org.business_name || "IMS"} — {TABS.find(([v]) => v === tab)?.[1]}</h1>
              <p className="text-xs text-slate-500">Party: {selectedParty?.name || (tab === "walkin" ? "Walk-in Customers" : "All Parties")} • Branch: {branch?.name || "All Branches"}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Period: {PRESETS.find(([v]) => v === preset)?.[1]}</p>
              <p>Printed: {fmtDate(new Date().toISOString(), true)}</p>
            </div>
          </div>
        </div>

        <div className="stagger-in mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
          <StatCard compact label={tab === "supplier" ? "Total Paid (Dr)" : "Total Billed (Dr)"} value={money(totalDebit)} sub={`${rows.length} entries`} icon={BookOpen} tone="indigo" />
          <StatCard compact label={tab === "supplier" ? "Total Payable (Cr)" : "Total Received (Cr)"} value={money(totalCredit)} sub="Payments & returns" icon={BookOpen} tone="emerald" />
          <StatCard compact label={netBalance >= 0 ? "Net Due Balance" : "Net Advance"} value={money(Math.abs(netBalance))} sub={netBalance > 0 ? (tab === "supplier" ? "Payable to supplier" : "Receivable from customer") : netBalance < 0 ? "Advance credit" : "Settled"} icon={BookOpen} tone={netBalance > 0 ? "red" : "cyan"} />
          <StatCard compact label="Advance Pool" value={money(totalAdvance)} sub={tab === "walkin" ? "N/A for walk-in" : "Unapplied advance"} icon={BookOpen} tone="violet" />
        </div>

        <Card>
          <CardHeader title={`${TABS.find(([v]) => v === tab)?.[1]} Statement`} sub={`${rows.length} transaction(s) in selected period`} />
          {loading ? (
            <div className="skeleton m-4 h-48" />
          ) : rows.length === 0 ? (
            <EmptyState icon={BookOpen} title="No ledger entries found" sub="Adjust your date range, party, or search filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[12.5px] print:min-w-0 print:text-[10.5px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60">
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Ref</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Party</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Particulars</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Debit</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Credit</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition hover:bg-blue-50/35 dark:hover:bg-slate-800/50">
                      <td className="px-3.5 py-2 text-slate-500">{fmtDate(r.date)}</td>
                      <td className="px-3.5 py-2 font-semibold text-blue-600 dark:text-blue-400">{r.ref}</td>
                      <td className="px-3.5 py-2 font-medium text-slate-800 dark:text-slate-100">{r.party}</td>
                      <td className="px-3.5 py-2 text-slate-500">{r.typeLabel}{r.note ? ` • ${r.note}` : ""}</td>
                      <td className="tnum px-3.5 py-2 text-right font-medium text-slate-800 dark:text-slate-100">{r.debit > 0 ? money(r.debit) : "—"}</td>
                      <td className="tnum px-3.5 py-2 text-right font-medium text-emerald-600">{r.credit > 0 ? money(r.credit) : "—"}</td>
                      <td className="tnum px-3.5 py-2 text-right font-bold">
                        <span className={r.balance > 0 ? "text-red-600" : r.balance < 0 ? "text-emerald-600" : "text-slate-500"}>
                          {money(Math.abs(r.balance))} {r.balance > 0 ? "Due" : r.balance < 0 ? "Adv" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
