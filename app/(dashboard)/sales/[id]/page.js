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

      <Card className="print-area print-half-a4 mx-auto max-w-3xl p-4 text-slate-800 dark:text-slate-100 print:p-2 print:text-slate-800">
        {/* Minimal IMS Header — Left business info, Right pinned invoice badge & date */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-1.5 dark:border-slate-800 print:border-slate-400 print:pb-1">
          <div className="min-w-0 flex-1">
            <span className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white print:text-[13px] print:text-slate-900">{org.business_name || "IMS"}</span>
            {(addressLine || phoneLine) && (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300 print:text-[9px] print:text-slate-700">
                {[addressLine, phoneLine ? `Tel: ${phoneLine}` : ""].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="whitespace-nowrap rounded bg-slate-200/80 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-800 dark:bg-slate-700 dark:text-slate-100 print:border print:border-slate-400 print:bg-slate-200 print:text-[9.5px] print:text-slate-800">Sales Invoice</span>
              <span className="print:hidden">{statusBadge(sale.status)}</span>
            </div>
            <p className="mt-0.5 whitespace-nowrap text-[10.5px] font-medium text-slate-500 dark:text-slate-300 print:text-[8.5px] print:text-slate-700">{fmtShortDate(sale.created_at)} • {fmtShortTime(sale.created_at)}</p>
          </div>
        </div>

        {/* Minimal Single-Line Meta Strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b border-slate-200 py-1 text-[11.5px] dark:border-slate-800 print:border-slate-300 print:py-0.5 print:text-[9px]">
          <span className="whitespace-nowrap"><strong className="font-semibold text-slate-700 dark:text-slate-200 print:text-slate-800">SerialNo:</strong> <span className="font-bold text-blue-700 dark:text-blue-400 print:text-slate-900">{sale.invoice_no}</span></span>
          <span className="whitespace-nowrap"><strong className="font-semibold text-slate-700 dark:text-slate-200 print:text-slate-800">Type:</strong> <span className="font-semibold uppercase">{sale.payment_method}</span></span>
          <span className="min-w-0 truncate"><strong className="font-semibold text-slate-700 dark:text-slate-200 print:text-slate-800">To:</strong> <span className="font-semibold">{customer?.name || "Walk-in Customer"}</span></span>
          {receipt.show_cashier !== false && <span className="whitespace-nowrap"><strong className="font-semibold text-slate-700 dark:text-slate-200 print:text-slate-800">User:</strong> <span className="font-semibold">{sale.cashier_name || "Admin"}</span></span>}
        </div>

        {/* Ultra-Compact Single-Line Items Table with Soft Slate Header */}
        <div className="mt-1 overflow-x-auto print:mt-0.5">
          <table className="w-full border-collapse border border-slate-300 text-[11.5px] dark:border-slate-700 print:border-slate-400 print:text-[9px]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 print:border-slate-400 print:bg-slate-200 print:text-[8px] print:text-slate-900">
                <th className="w-8 whitespace-nowrap border-r border-slate-300 px-1.5 py-1 text-center dark:border-slate-700 print:border-slate-400 print:py-0.5">S.No</th>
                <th className="whitespace-nowrap border-r border-slate-300 px-2 py-1 text-left dark:border-slate-700 print:border-slate-400 print:px-1.5 print:py-0.5">Item Name</th>
                <th className="whitespace-nowrap border-r border-slate-300 px-2 py-1 text-left dark:border-slate-700 print:border-slate-400 print:px-1.5 print:py-0.5">Description</th>
                <th className="w-10 whitespace-nowrap border-r border-slate-300 px-1.5 py-1 text-center dark:border-slate-700 print:border-slate-400 print:py-0.5">QTY</th>
                <th className="whitespace-nowrap border-r border-slate-300 px-2 py-1 text-right dark:border-slate-700 print:border-slate-400 print:px-1.5 print:py-0.5">Rate</th>
                <th className="whitespace-nowrap px-2 py-1 text-right print:px-1.5 print:py-0.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-300">
              {items.map((i, idx) => (
                <tr key={i.id} className="leading-none">
                  <td className="tnum whitespace-nowrap border-r border-slate-200 px-1.5 py-0.5 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300 print:border-slate-300 print:py-[1.5px] print:text-slate-800">{idx + 1}</td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-2 py-0.5 font-medium text-slate-800 dark:border-slate-700 dark:text-slate-100 print:border-slate-300 print:px-1.5 print:py-[1.5px] print:text-slate-900">{i.product_name}</td>
                  <td className="max-w-[160px] truncate border-r border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300 print:border-slate-300 print:px-1.5 print:py-[1.5px] print:text-slate-800">{descMap[i.product_id] || "—"}</td>
                  <td className="tnum whitespace-nowrap border-r border-slate-200 px-1.5 py-0.5 text-center text-slate-800 dark:border-slate-700 dark:text-slate-200 print:border-slate-300 print:py-[1.5px] print:text-slate-900">{n(i.qty)}</td>
                  <td className="tnum whitespace-nowrap border-r border-slate-200 px-2 py-0.5 text-right text-slate-700 dark:border-slate-700 dark:text-slate-200 print:border-slate-300 print:px-1.5 print:py-[1.5px] print:text-slate-800">{money(i.price)}</td>
                  <td className="tnum whitespace-nowrap px-2 py-0.5 text-right font-semibold text-slate-900 dark:text-white print:px-1.5 print:py-[1.5px] print:text-slate-900">{money(i.line_total ?? n(i.price) * n(i.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Compact Bottom Split — Consistent Balanced Labels */}
        <div className="mt-1.5 flex flex-col justify-between gap-2 border-t border-slate-200 pt-1.5 sm:flex-row sm:items-start dark:border-slate-800 print:mt-1 print:flex-row print:gap-3 print:border-slate-400 print:pt-1">
          <div className="min-w-0 flex-1 space-y-0.5 text-[11px] print:text-[8.5px]">
            <p><strong className="font-semibold text-slate-800 dark:text-white print:text-slate-800">In words:</strong> <span className="capitalize text-slate-700 dark:text-slate-200 print:text-slate-800">{numToWords(sale.total)}</span></p>
            {receipt.sale_policy && <p><strong className="font-semibold text-slate-800 dark:text-white print:text-slate-800">Sale Policy:</strong> <span className="text-slate-700 dark:text-slate-200 print:text-slate-800">{receipt.sale_policy}</span></p>}
            {receipt.instructions && <p><strong className="font-semibold text-slate-800 dark:text-white print:text-slate-800">Instructions:</strong> <span className="text-slate-700 dark:text-slate-200 print:text-slate-800">{receipt.instructions}</span></p>}
            {receipt.footer && <p className="text-slate-600 dark:text-slate-300 print:text-slate-700">{receipt.footer}</p>}
          </div>

          <div className="w-full shrink-0 space-y-0.5 text-[11.5px] sm:w-56 print:w-48 print:text-[9px]">
            {n(sale.discount) > 0 && (
              <div className="flex justify-between text-slate-700 dark:text-slate-200 print:text-slate-800">
                <strong className="font-semibold">Discount</strong>
                <span className="tnum font-medium">−{money(sale.discount)}</span>
              </div>
            )}
            {receipt.show_tax !== false && n(sale.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-700 dark:text-slate-200 print:text-slate-800">
                <strong className="font-semibold">Tax ({n(sale.tax_rate)}%)</strong>
                <span className="tnum font-medium">{money(sale.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 dark:text-white print:text-slate-900">
              <span>Inv Amount</span>
              <span className="tnum">{money(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-700 dark:text-slate-200 print:text-slate-800">
              <strong className="font-semibold">Paid</strong>
              <span className="tnum font-medium">{money(sale.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-slate-700 dark:text-slate-200 print:text-slate-800">
              <strong className="font-semibold">Previous Balance</strong>
              <span className="tnum font-medium">{money(prevBalance)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-400 pt-0.5 font-bold text-slate-900 dark:border-slate-500 dark:text-white print:border-slate-700 print:text-slate-900">
              <span>Remaining Balance</span>
              <span className={`tnum ${remainingBalance > 0 ? "text-red-600 print:text-slate-900" : "text-emerald-700 print:text-slate-900"}`}>{money(remainingBalance)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
