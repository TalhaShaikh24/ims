"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSetting } from "@/lib/data";
import { money, n, round2 } from "@/lib/utils";
import { Button, Card, SchemaBanner, statusBadge } from "@/components/ui";

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numToWords(num) {
  const val = Math.round(Math.abs(n(num)));
  if (val === 0) return "Zero Only";
  const below1000 = (x) => {
    if (x === 0) return "";
    if (x < 20) return ONES[x];
    if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? " " + ONES[x % 10] : "");
    return ONES[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " + below1000(x % 100) : "");
  };
  const parts = [];
  const crore = Math.floor(val / 10000000);
  const lakh = Math.floor((val % 10000000) / 100000);
  const thousand = Math.floor((val % 100000) / 1000);
  const rest = val % 1000;
  if (crore) parts.push(below1000(crore) + " crore");
  if (lakh) parts.push(below1000(lakh) + " lakh");
  if (thousand) parts.push(below1000(thousand) + " thousand");
  if (rest) parts.push(below1000(rest));
  return parts.join(" ").trim() + " Only";
}

function fmtShortDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-GB");
}
function fmtShortTime(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export default function InvoicePage({ params }) {
  const { id } = use(params);
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [descMap, setDescMap] = useState({});
  const [customer, setCustomer] = useState(null);
  const [branch, setBranch] = useState(null);
  const [prevBalance, setPrevBalance] = useState(0);
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
      const [{ data: its }, { data: cust }, { data: br }, { data: prevSales }] = await Promise.all([
        sb.from("sale_items").select("*").eq("sale_id", id),
        s.customer_id ? sb.from("customers").select("*").eq("id", s.customer_id).maybeSingle() : Promise.resolve({ data: null }),
        s.branch_id ? sb.from("branches").select("*").eq("id", s.branch_id).maybeSingle() : Promise.resolve({ data: null }),
        s.customer_id ? sb.from("sales").select("total,amount_paid").eq("customer_id", s.customer_id).lt("created_at", s.created_at) : Promise.resolve({ data: [] }),
      ]);
      const prodIds = [...new Set((its || []).map((i) => i.product_id).filter(Boolean))];
      if (prodIds.length) {
        const { data: prods } = await sb.from("products").select("id,description").in("id", prodIds);
        const dm = {};
        (prods || []).forEach((p) => { if (p.description) dm[p.id] = p.description; });
        setDescMap(dm);
      }
      setPrevBalance(round2((prevSales || []).reduce((a, x) => a + Math.max(0, n(x.total) - n(x.amount_paid)), 0)));
      setItems(its || []); setCustomer(cust); setBranch(br);
      setOrg(await getSetting("org", { business_name: "IMS" }));
      setReceipt(await getSetting("receipt", {}));
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="skeleton h-96 w-full" />;
  if (!sale) return <div className="page-in"><SchemaBanner error={error} /><p className="text-sm text-slate-500">Invoice not found.</p><Link href="/sales"><Button variant="secondary" className="mt-4"><ArrowLeft className="h-4 w-4" /> Back to Sales</Button></Link></div>;

  const invDue = round2(Math.max(0, n(sale.total) - n(sale.amount_paid)));
  const remainingBalance = round2(prevBalance + invDue);
  const addressLine = org.address || branch?.address || "";
  const phoneLine = org.phone || branch?.phone || "";

  return (
    <div className="page-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Back to Sales Invoices</Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-400 sm:inline">Print format: Half A4 (Compact)</span>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Invoice</Button>
        </div>
      </div>

      <Card className="print-area print-half-a4 mx-auto max-w-3xl p-5 text-slate-900 dark:text-slate-100 print:p-2">
        {/* Top Business Line */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-lg font-extrabold tracking-tight text-blue-950 dark:text-white print:text-[15px] print:text-slate-900">{org.business_name || "IMS"}</span>
            {addressLine && <span className="text-[11.5px] text-slate-600 dark:text-slate-300 print:text-[9.5px]">{addressLine}</span>}
            {phoneLine && <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 print:text-[9.5px]">Mobile {phoneLine}</span>}
          </div>
          <span className="text-[10.5px] text-slate-400 print:text-[8.5px]">Page 1 of 1</span>
        </div>

        {/* Boxed Sales Invoice + Date/Time Line */}
        <div className="mt-1.5 flex items-center gap-3">
          <div className="shrink-0 border-2 border-slate-800 bg-white px-5 py-0.5 text-center shadow-[3px_3px_0_#0f172a] dark:border-slate-300 dark:bg-slate-900 dark:shadow-[3px_3px_0_#64748b] print:border print:px-4 print:py-0.5 print:shadow-[2px_2px_0_#0f172a]">
            <span className="text-base font-bold tracking-wide text-purple-900 dark:text-purple-300 print:text-[13px] print:text-slate-900">Sales Invoice</span>
          </div>
          <div className="flex-1 border-t border-slate-400 pt-1 text-right text-[10.5px] text-slate-600 dark:text-slate-300 print:text-[9px]">
            <span className="mr-4">{fmtShortTime(sale.created_at)}</span>
            <span>{fmtShortDate(sale.created_at)}</span>
          </div>
        </div>

        {/* Meta Rows */}
        <div className="mt-2.5 space-y-1 text-[12px] print:mt-1.5 print:space-y-0.5 print:text-[10px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">SerialNo :</strong> <span className="font-bold text-teal-700 underline dark:text-teal-300 print:text-slate-900">{sale.invoice_no}</span></span>
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">Type :</strong> <span className="font-semibold uppercase underline">{sale.payment_method}</span></span>
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">Date :</strong> <span className="underline">{fmtShortDate(sale.created_at)}</span></span>
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">Time :</strong> <span className="underline">{fmtShortTime(sale.created_at)}</span></span>
            <span className="print:hidden">{statusBadge(sale.status)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">To,</strong> <span className="ml-2 font-semibold uppercase text-blue-900 underline dark:text-blue-300 print:text-slate-900">{customer?.name || "Walk-in Customer"}</span></span>
            <span><strong className="text-red-900 dark:text-red-300 print:text-slate-800">User :</strong> <span className="font-medium">{sale.cashier_name || "Admin"}</span></span>
          </div>
        </div>

        {/* Compact Bordered Items Table */}
        <div className="mt-2 overflow-x-auto print:mt-1.5">
          <table className="w-full border-collapse border border-slate-800 text-[12px] dark:border-slate-600 print:text-[9.5px]">
            <thead>
              <tr className="border-b-2 border-slate-800 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/60">
                <th className="w-10 border-r border-slate-300 px-1.5 py-1 text-center font-bold text-red-950 dark:border-slate-600 dark:text-slate-200 print:py-0.5">S.No</th>
                <th className="border-r border-slate-300 px-2 py-1 text-left font-bold text-red-950 dark:border-slate-600 dark:text-slate-200 print:py-0.5">Item Name</th>
                <th className="border-r border-slate-300 px-2 py-1 text-left font-bold text-red-950 dark:border-slate-600 dark:text-slate-200 print:py-0.5">Description</th>
                <th className="w-14 border-r border-slate-300 px-1.5 py-1 text-center font-bold text-red-950 dark:border-slate-600 dark:text-slate-200 print:py-0.5">QTY</th>
                <th className="w-20 border-r border-slate-300 px-2 py-1 text-right font-bold text-red-950 dark:border-slate-600 dark:text-slate-200 print:py-0.5">Rate</th>
                <th className="w-24 px-2 py-1 text-right font-bold text-red-950 dark:text-slate-200 print:py-0.5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.id} className="border-b border-slate-300 dark:border-slate-700">
                  <td className="tnum border-r border-slate-300 px-1.5 py-1 text-center dark:border-slate-700 print:py-0.5">{idx + 1}</td>
                  <td className="border-r border-slate-300 px-2 py-1 font-medium dark:border-slate-700 print:py-0.5">{i.product_name}</td>
                  <td className="border-r border-slate-300 px-2 py-1 text-slate-500 dark:border-slate-700 print:py-0.5">{descMap[i.product_id] || ""}</td>
                  <td className="tnum border-r border-slate-300 px-1.5 py-1 text-center dark:border-slate-700 print:py-0.5">{n(i.qty)}</td>
                  <td className="tnum border-r border-slate-300 px-2 py-1 text-right dark:border-slate-700 print:py-0.5">{money(i.price)}</td>
                  <td className="tnum px-2 py-1 text-right font-semibold print:py-0.5">{money(i.line_total ?? n(i.price) * n(i.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Split: Words + Policy/Instructions (Left) | Balances (Right) */}
        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-start print:mt-1.5 print:flex-row print:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5 text-[11.5px] print:space-y-1 print:text-[9.5px]">
            <p><strong className="text-red-950 dark:text-red-300 print:text-slate-900">In words:</strong> <span className="font-mono capitalize text-slate-700 dark:text-slate-200">{numToWords(sale.total)}</span></p>
            {(receipt.header || receipt.footer) ? (
              <div className="space-y-0.5 pt-0.5">
                {receipt.header && <p><strong className="text-red-950 dark:text-red-300 print:text-slate-900">Sale Policy :</strong> <span className="text-slate-600 dark:text-slate-300">{receipt.header}</span></p>}
                {receipt.footer && <p><strong className="text-red-950 dark:text-red-300 print:text-slate-900">Instructions :</strong> <span className="text-slate-600 dark:text-slate-300">{receipt.footer}</span></p>}
              </div>
            ) : (
              <p className="pt-0.5 text-slate-500">Thank you for shopping with us!</p>
            )}
          </div>

          <div className="w-full shrink-0 space-y-0.5 text-[12px] sm:w-60 print:w-52 print:text-[9.5px]">
            {n(sale.discount) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Discount :</span>
                <span className="tnum font-medium text-emerald-600">−{money(sale.discount)}</span>
              </div>
            )}
            {receipt.show_tax !== false && n(sale.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax ({n(sale.tax_rate)}%) :</span>
                <span className="tnum font-medium">{money(sale.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-800 pt-0.5 font-bold dark:border-slate-500">
              <span className="text-red-950 dark:text-slate-200 print:text-slate-900">Inv Amount :</span>
              <span className="tnum">{money(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Paid :</span>
              <span className="tnum font-medium">{money(sale.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-red-950 dark:text-slate-200 print:text-slate-900">Previous Balance :</span>
              <span className="tnum font-medium">{money(prevBalance)}</span>
            </div>
            <div className="flex justify-between border-y-2 border-slate-800 py-0.5 font-extrabold dark:border-slate-500">
              <span className="text-red-950 dark:text-slate-100 print:text-slate-900">Remaining Balance :</span>
              <span className={`tnum ${remainingBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(remainingBalance)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
