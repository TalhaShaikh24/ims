"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSetting } from "@/lib/data";
import { fmtDate, money, n } from "@/lib/utils";
import { Button, Card, SchemaBanner, statusBadge } from "@/components/ui";

export default function InvoicePage({ params }) {
  const { id } = use(params);
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [branch, setBranch] = useState(null);
  const [org, setOrg] = useState({ business_name: "XonaERP" });
  const [receipt, setReceipt] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      if (!sb) { setError({ notConfigured: true }); setLoading(false); return; }
      const { data: s, error: e } = await sb.from("sales").select("*").eq("id", id).single();
      if (e) { setError(e); setLoading(false); return; }
      setSale(s);
      const [{ data: its }, { data: cust }, { data: br }] = await Promise.all([
        sb.from("sale_items").select("*").eq("sale_id", id),
        s.customer_id ? sb.from("customers").select("*").eq("id", s.customer_id).maybeSingle() : Promise.resolve({ data: null }),
        s.branch_id ? sb.from("branches").select("*").eq("id", s.branch_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setItems(its || []); setCustomer(cust); setBranch(br);
      setOrg(await getSetting("org", { business_name: "XonaERP" }));
      setReceipt(await getSetting("receipt", {}));
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="skeleton h-96 w-full" />;
  if (!sale) return <div className="page-in"><SchemaBanner error={error} /><p className="text-sm text-slate-500">Invoice not found.</p><Link href="/sales"><Button variant="secondary" className="mt-4"><ArrowLeft className="h-4 w-4" /> Back to Sales</Button></Link></div>;

  return (
    <div className="page-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600"><ArrowLeft className="h-4 w-4" /> Back to Sales Invoices</Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Receipt</Button>
      </div>
      <Card className="print-area mx-auto max-w-3xl">
        <div className="border-b border-slate-100 px-8 py-6 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">X</div><span className="text-lg font-semibold">{org.business_name || "XonaERP"}</span></div>
              <p className="mt-2 text-[13px] text-slate-500">{receipt.header || ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{sale.invoice_no}</p>
              <p className="mt-1 text-[13px] text-slate-500">{fmtDate(sale.created_at, true)}</p>
              <div className="mt-2">{statusBadge(sale.status)}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-8 py-5 text-sm sm:grid-cols-4">
          {[["Customer", customer?.name || "Walk-in Customer"], ["Branch", branch?.name || "—"], ["Payment Method", sale.payment_method], ["Cashier", sale.cashier_name || "Admin"]].map(([k, v]) => (
            <div key={k}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k}</p><p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{v}</p></div>
          ))}
        </div>
        <div className="px-8">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40"><th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Item</th><th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Price</th><th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Qty</th><th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((i) => (
                <tr key={i.id}><td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-100">{i.product_name}</td><td className="tnum px-3 py-3 text-right text-slate-500">{money(i.price)}</td><td className="tnum px-3 py-3 text-center text-slate-500">{n(i.qty)}</td><td className="tnum px-3 py-3 text-right font-semibold">{money(n(i.price) * n(i.qty))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-8 py-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(sale.subtotal)}</span></div>
            {n(sale.discount) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span className="tnum font-medium text-emerald-600">−{money(sale.discount)}</span></div>}
            {receipt.show_tax !== false && <div className="flex justify-between text-slate-500"><span>Tax ({n(sale.tax_rate)}%)</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(sale.tax_amount)}</span></div>}
            <div className="flex justify-between border-t border-dashed border-slate-200 pt-3 text-base font-bold dark:border-slate-700"><span>Total</span><span className="tnum">{money(sale.total)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Amount Paid</span><span className="tnum font-medium">{money(sale.amount_paid)}</span></div>
          </div>
        </div>
        <p className="border-t border-slate-100 px-8 py-4 text-center text-[13px] text-slate-400 dark:border-slate-800">{receipt.footer || "Thank you for your business!"}</p>
      </Card>
    </div>
  );
}
