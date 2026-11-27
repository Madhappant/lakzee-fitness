/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDashboardRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4FF00" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#D4FF00" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(245, 245, 247, 0.08)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(245, 245, 247, 0.55)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(245, 245, 247, 0.55)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `₹${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(10, 10, 12, 0.92)",
            borderColor: "rgba(245, 245, 247, 0.12)",
            borderRadius: "12px",
            color: "#F5F5F7",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
          itemStyle={{ color: "#D4FF00", fontWeight: 700 }}
          labelStyle={{ color: "rgba(245, 245, 247, 0.65)", marginBottom: "4px" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#D4FF00"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorDashboardRevenue)"
          activeDot={{ r: 5, fill: "#D4FF00", stroke: "#0A0A0C", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
