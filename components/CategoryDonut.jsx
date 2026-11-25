"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { money, n } from "@/lib/utils";

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#0EA5E9", "#8B5CF6", "#EF4444", "#14B8A6"];

export default function CategoryDonut({ data }) {
  const total = data.reduce((a, d) => a + n(d.value), 0) || 1;
  return (
    <div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={63} outerRadius={85} paddingAngle={2} strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [money(v), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 13 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 px-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="tnum font-bold text-slate-800 dark:text-slate-100">{Math.round((n(d.value) / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
