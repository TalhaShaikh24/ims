"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/utils";

export default function SalesAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => "PKR " + v} width={68} />
        <Tooltip formatter={(v) => [money(v), "Sales"]} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12.5, boxShadow: "0 8px 24px rgba(15,23,42,.08)" }} />
        <Area type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2.2} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
