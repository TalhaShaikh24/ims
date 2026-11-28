"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, Landmark, Lock, Unlock, Wallet } from "lucide-react";
import { getSetting, logAudit, setSetting, useTable } from "@/lib/data";
import { fmtDate, money, n, round2 } from "@/lib/utils";
import { useAuth, useBranch } from "@/components/Shell";
import { Badge, Button, Card, CardHeader, DataTable, Field, Input, Modal, PageHeader, StatCard, Textarea, useToast } from "@/components/ui";

export default function CashRegisterPage() {
  const toast = useToast();
  const { profile, user } = useAuth();
  const { branchId } = useBranch();
  const salesQ = useTable("sales", (q) => q.order("created_at", { ascending: false }));
  const expQ = useTable("expenses", (q) => q.order("created_at", { ascending: false }));

  const [reg, setReg] = useState({ active: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting("cash_register", { active: null, history: [] }).then((v) => {
      if (v && typeof v === "object") setReg({ active: v.active || null, history: Array.isArray(v.history) ? v.history : [] });
      setLoading(false);
    });
  }, []);

  const shiftStats = useMemo(() => {
    const start = reg.active?.opened_at ? new Date(reg.active.opened_at).getTime() : 0;
    const byBranch = (r) => branchId === "all" || r.branch_id === branchId || r.branch_id == null;
    const cashSales = reg.active
      ? salesQ.rows.filter((s) => byBranch(s) && s.payment_method === "Cash" && new Date(s.created_at).getTime() >= start).reduce((a, s) => a + n(s.amount_paid), 0)
      : 0;
    const cashExpenses = reg.active
      ? expQ.rows.filter((e) => byBranch(e) && (e.payment_method || "Cash") === "Cash" && new Date(e.created_at).getTime() >= start).reduce((a, e) => a + n(e.amount), 0)
      : 0;
    const opening = n(reg.active?.opening_cash);
    const expected = round2(opening + cashSales - cashExpenses);
    return { opening, cashSales: round2(cashSales), cashExpenses: round2(cashExpenses), expected };
  }, [reg.active, salesQ.rows, expQ.rows, branchId]);

  async function handleOpenShift(e) {
    e.preventDefault();
    setSaving(true);
    const shift = {
      id: Date.now().toString(36),
      opened_at: new Date().toISOString(),
      opened_by: profile?.full_name || user?.email || "Admin",
      opening_cash: round2(n(openingCash)),
      notes: notes.trim(),
    };
    const next = { ...reg, active: shift };
    try {
      await setSetting("cash_register", next);
      await logAudit("Shift Open", `Cash register opened with ${money(shift.opening_cash)}`);
      setReg(next); setOpenModal(false); setNotes("");
      toast("Cash register shift opened.");
    } catch (err) { toast(err.message, "error"); }
    setSaving(false);
  }

  async function handleCloseShift(e) {
    e.preventDefault();
    if (!reg.active) return;
    setSaving(true);
    const actual = round2(n(actualCash));
    const variance = round2(actual - shiftStats.expected);
    const closed = {
      ...reg.active,
      closed_at: new Date().toISOString(),
      closed_by: profile?.full_name || user?.email || "Admin",
      cash_sales: shiftStats.cashSales,
      cash_expenses: shiftStats.cashExpenses,
      expected_cash: shiftStats.expected,
      actual_cash: actual,
      variance,
      close_notes: notes.trim(),
    };
    const next = { active: null, history: [closed, ...reg.history].slice(0, 50) };
    try {
      await setSetting("cash_register", next);
      await logAudit("Shift Close", `Closed with ${money(actual)} (expected ${money(shiftStats.expected)}, variance ${money(variance)})`);
      setReg(next); setCloseModal(false); setNotes(""); setActualCash("");
      toast("Cash register shift closed.");
    } catch (err) { toast(err.message, "error"); }
    setSaving(false);
  }

  return (
    <div className="page-in">
      <PageHeader title="Cash Register & Shifts" sub="Daily cash drawer opening, live cash flow, and shift closing reconciliation">
        {reg.active ? (
          <Button variant="danger" onClick={() => { setActualCash(String(shiftStats.expected)); setNotes(""); setCloseModal(true); }}>
            <Lock className="h-4 w-4" /> Close Current Shift
          </Button>
        ) : (
          <Button variant="green" onClick={() => { setOpeningCash("0"); setNotes(""); setOpenModal(true); }} disabled={loading}>
            <Unlock className="h-4 w-4" /> Open Register Shift
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[13px] shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {reg.active ? (
          <>
            <Badge tone="green">Shift Open</Badge>
            <span className="text-slate-600 dark:text-slate-300">Opened by <strong>{reg.active.opened_by}</strong> on {fmtDate(reg.active.opened_at, true)}</span>
          </>
        ) : (
          <>
            <Badge tone="slate">Register Closed</Badge>
            <span className="text-slate-500">Open a new shift before starting daily cash billing.</span>
          </>
        )}
      </div>

      <div className="stagger-in mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Opening Cash" value={money(shiftStats.opening)} sub="Starting drawer float" icon={Wallet} tone="indigo" />
        <StatCard label="Cash Sales (+)" value={money(shiftStats.cashSales)} sub="Collected in current shift" icon={ArrowUpCircle} tone="emerald" />
        <StatCard label="Cash Expenses (−)" value={money(shiftStats.cashExpenses)} sub="Paid out from drawer" icon={ArrowDownCircle} tone="amber" />
        <StatCard label="Expected in Drawer" value={money(shiftStats.expected)} sub="Opening + Sales − Expenses" icon={Landmark} tone="cyan" />
      </div>

      <Card>
        <CardHeader title="Shift Closing History" sub="Completed register shifts and cash variances" />
        <DataTable
          rows={reg.history}
          loading={loading}
          columns={[
            { label: "Opened", render: (h) => <span className="text-slate-500">{fmtDate(h.opened_at, true)}</span> },
            { label: "Closed", render: (h) => <span className="text-slate-500">{fmtDate(h.closed_at, true)}</span> },
            { label: "Staff", render: (h) => <span className="font-medium text-slate-800 dark:text-slate-100">{h.closed_by || h.opened_by}</span> },
            { label: "Opening", align: "right", render: (h) => money(h.opening_cash) },
            { label: "Cash Sales", align: "right", render: (h) => money(h.cash_sales) },
            { label: "Expected", align: "right", render: (h) => money(h.expected_cash) },
            { label: "Actual", align: "right", render: (h) => money(h.actual_cash) },
            { label: "Variance", align: "right", render: (h) => <span className={n(h.variance) === 0 ? "text-emerald-600" : n(h.variance) > 0 ? "text-blue-600" : "text-red-600"}>{money(h.variance)}</span> },
          ]}
        />
      </Card>

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Open Cash Register Shift" sub="Enter the starting cash float in the drawer.">
        <form onSubmit={handleOpenShift} className="space-y-4">
          <Field label="Opening Cash Float (PKR)" required>
            <Input type="number" step="any" min="0" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} required autoFocus />
          </Field>
          <Field label="Notes (optional)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shift notes…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenModal(false)}>Cancel</Button>
            <Button type="submit" variant="green" disabled={saving}><CheckCircle2 className="h-4 w-4" /> {saving ? "Opening…" : "Open Shift"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Close Cash Register Shift" sub="Count the physical cash in your drawer and confirm.">
        <form onSubmit={handleCloseShift} className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/50 space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Expected Cash in Drawer</span><span className="tnum font-bold text-slate-900 dark:text-white">{money(shiftStats.expected)}</span></div>
            {actualCash !== "" && (
              <div className="flex justify-between"><span className="text-slate-500">Variance (Actual − Expected)</span><span className={`tnum font-bold ${round2(n(actualCash) - shiftStats.expected) === 0 ? "text-emerald-600" : "text-amber-600"}`}>{money(round2(n(actualCash) - shiftStats.expected))}</span></div>
            )}
          </div>
          <Field label="Actual Counted Cash (PKR)" required>
            <Input type="number" step="any" min="0" value={actualCash} onChange={(e) => setActualCash(e.target.value)} required autoFocus />
          </Field>
          <Field label="Closing Notes (optional)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any variance notes…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCloseModal(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={saving}><Clock className="h-4 w-4" /> {saving ? "Closing…" : "Close & Save Shift"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
