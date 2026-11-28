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
  const [org, setOrg] = useState({ business_name: "IMS" });
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
      setOrg(await getSetting("org", { business_name: "IMS" }));
      setReceipt(await getSetting("receipt", {}));
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="skeleton h-96 w-full" />;
  if (!sale) return <div className="page-in"><SchemaBanner error={error} /><p className="text-sm text-slate-500">Invoice not found.</p><Link href="/sales"><Button variant="secondary" className="mt-4"><ArrowLeft className="h-4 w-4" /> Back to Sales</Button></Link></div>;

  return (
    <div className="page-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Back to Sales Invoices</Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-400 sm:inline">Print format: A4 Portrait (Compact)</span>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Invoice</Button>
        </div>
      </div>
      <Card className="print-area print-a4-portrait mx-auto max-w-3xl">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800 print:px-2 print:py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-3 print:gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white print:h-6 print:w-6 print:text-[10px]">IMS</div>
                <span className="text-base font-bold print:text-sm">{org.business_name || "IMS"}</span>
              </div>
              {receipt.header && <p className="mt-1 whitespace-pre-line text-[12px] text-slate-500 print:mt-0.5 print:text-[10px]">{receipt.header}</p>}
              {(org.address || org.phone || branch?.address) && (
                <p className="mt-0.5 text-[11.5px] text-slate-400 print:text-[9.5px]">
                  {[org.address || branch?.address, org.phone || branch?.phone].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white print:text-sm">{sale.invoice_no}</p>
              <p className="mt-0.5 text-[11.5px] text-slate-500 print:text-[9.5px]">{fmtDate(sale.created_at, true)}</p>
              <div className="mt-1 print:hidden">{statusBadge(sale.status)}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-5 py-2.5 text-[12.5px] sm:grid-cols-4 print:grid-cols-4 print:gap-2 print:px-2 print:py-1 print:text-[10px]">
          {[["Customer", customer?.name || "Walk-in Customer"], ["Branch", branch?.name || "—"], ["Payment", sale.payment_method], ["Cashier", sale.cashier_name || "Admin"]].map(([k, v]) => (
            <div key={k} className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 print:text-[8.5px]">{k}: </span><span className="truncate font-medium text-slate-800 dark:text-slate-100">{v}</span></div>
          ))}
        </div>
        <div className="px-5 print:px-2">
          <table className="w-full text-[13px] print:text-[10.5px]">
            <thead><tr className="border-y border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40"><th className="px-2.5 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 print:px-1.5 print:py-1 print:text-[9px]">Item</th><th className="px-2.5 py-1.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 print:px-1.5 print:py-1 print:text-[9px]">Price</th><th className="px-2.5 py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 print:px-1.5 print:py-1 print:text-[9px]">Qty</th><th className="px-2.5 py-1.5 text-right text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 print:px-1.5 print:py-1 print:text-[9px]">Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((i) => (
                <tr key={i.id}><td className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-100 print:px-1.5 print:py-0.5">{i.product_name}</td><td className="tnum px-2.5 py-1.5 text-right text-slate-500 print:px-1.5 print:py-0.5">{money(i.price)}</td><td className="tnum px-2.5 py-1.5 text-center text-slate-500 print:px-1.5 print:py-0.5">{n(i.qty)}</td><td className="tnum px-2.5 py-1.5 text-right font-semibold print:px-1.5 print:py-0.5">{money(i.line_total ?? n(i.price) * n(i.qty))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-5 py-3 print:px-2 print:py-1.5">
          <div className="w-60 space-y-1 text-[13px] print:w-52 print:space-y-0.5 print:text-[10.5px]">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(sale.subtotal)}</span></div>
            {n(sale.discount) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span className="tnum font-medium text-emerald-600">−{money(sale.discount)}</span></div>}
            {receipt.show_tax !== false && <div className="flex justify-between text-slate-500"><span>Tax ({n(sale.tax_rate)}%)</span><span className="tnum font-medium text-slate-800 dark:text-slate-100">{money(sale.tax_amount)}</span></div>}
            <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-700 print:pt-1 print:text-[11.5px]"><span>Total</span><span className="tnum">{money(sale.total)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Amount Paid</span><span className="tnum font-medium">{money(sale.amount_paid)}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-[11.5px] text-slate-400 dark:border-slate-800 print:px-2 print:py-1.5 print:text-[9.5px]">
          <span>{[org.address || branch?.address, org.phone || branch?.phone].filter(Boolean).join(" • ") || (branch?.name || "")}</span>
          <span className="whitespace-pre-line font-medium text-slate-500">{receipt.footer || "Thank you for shopping with us!"}</span>
        </div>
      </Card>
    </div>
  );
}
