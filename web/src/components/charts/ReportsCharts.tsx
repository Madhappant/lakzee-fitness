/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Maximize2 } from "lucide-react";
import { EntireDailyRevenueModal } from "@/components/reports/EntireDailyRevenueModal";

const COLORS = ['#DBA12C', '#F2C14E', '#F5F5F7', 'rgba(245, 245, 247, 0.45)'];

const getGenderColor = (name: string, index: number) => {
  if (name === 'Male') return '#DBA12C';
  if (name === 'Female') return '#F5F5F7';
  return COLORS[index % COLORS.length];
};

const getPaymentColor = (name: string, index: number) => {
  const upper = name?.toUpperCase();
  if (upper === 'CASH') return '#F5F5F7';
  if (upper === 'UPI') return '#DBA12C';
  if (upper === 'CARD') return '#F2C14E';
  return COLORS[index % COLORS.length];
};

const GLASS_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(18, 18, 22, 0.88)',
  backdropFilter: 'blur(16px)',
  borderColor: 'rgba(245, 245, 247, 0.16)',
  borderRadius: '14px',
  color: '#F5F5F7',
};

export default function ReportsCharts({ stats }: { stats: Record<string, any> }) {
  const [isEntireRevenueModalOpen, setIsEntireRevenueModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Daily Revenue Chart */}
        <div 
          onClick={() => setIsEntireRevenueModalOpen(true)}
          className="apple-glass rounded-2xl p-5 sm:p-6 min-h-[340px] flex flex-col cursor-pointer hover:border-[#DBA12C]/50 transition-all group"
        >
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold group-hover:text-[#F2C14E] transition-colors">Daily Revenue</h2>
              <span className="hidden sm:inline text-[10px] uppercase font-semibold tracking-wider text-muted-foreground group-hover:text-[#DBA12C] transition-colors">
                (Click to expand)
              </span>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEntireRevenueModalOpen(true);
              }} 
              className="flex items-center gap-1.5 text-xs text-[#F2C14E] bg-[#DBA12C]/15 hover:bg-[#DBA12C]/25 px-3 py-1.5 rounded-xl border border-[#DBA12C]/30 transition-all cursor-pointer shrink-0 focus-gold"
              title="View entire revenue earliest to latest"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Entire Timeline</span>
            </button>
          </div>
        <div className="flex-1 w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.dailyRevenue} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DBA12C" stopOpacity={0.38}/>
                  <stop offset="95%" stopColor="#F2C14E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis width={56} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
              <Tooltip 
                contentStyle={GLASS_TOOLTIP_STYLE}
                itemStyle={{ color: '#F2C14E', fontWeight: 700 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#DBA12C" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Visits Chart */}
      <div className="apple-glass rounded-2xl p-5 sm:p-6 min-h-[340px] flex flex-col">
        <h2 className="text-lg font-bold mb-4">Daily Visits</h2>
        <div className="flex-1 w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dailyVisits} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis width={42} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={GLASS_TOOLTIP_STYLE}
                itemStyle={{ color: '#F2C14E', fontWeight: 700 }}
                cursor={{ fill: 'rgba(245, 245, 247, 0.05)' }}
              />
              <Bar dataKey="visits" fill="#DBA12C" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Method Mix */}
      <div className="apple-glass rounded-2xl p-5 sm:p-6 min-h-[340px] flex flex-col">
        <h2 className="text-lg font-bold mb-4">Payment Method Mix (30d)</h2>
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-h-0">
          <div className="w-full sm:w-1/2 h-[215px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.paymentMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.paymentMix.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getPaymentColor(entry.name, index)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={GLASS_TOOLTIP_STYLE} itemStyle={{ color: '#F5F5F7', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Responsive Side/Bottom Legend */}
          <div className="w-full sm:w-1/2 flex flex-col gap-2.5">
            {stats.paymentMix.map((item: any, i: number) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] border border-border/60 px-3.5 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: getPaymentColor(item.name, i) }}
                  />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="font-mono-metric font-bold text-foreground tabular-nums shrink-0">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gender Mix */}
      <div className="apple-glass rounded-2xl p-5 sm:p-6 min-h-[340px] flex flex-col">
        <h2 className="text-lg font-bold mb-4">Gender Mix</h2>
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-h-0">
          <div className="w-full sm:w-1/2 h-[215px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.genderMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.genderMix.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getGenderColor(entry.name, index)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={GLASS_TOOLTIP_STYLE} itemStyle={{ color: '#F5F5F7', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full sm:w-1/2 flex flex-col gap-2.5">
            {stats.genderMix.map((item: any, i: number) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] border border-border/60 px-3.5 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: getGenderColor(item.name, i) }}
                  />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="font-mono-metric font-bold text-foreground tabular-nums shrink-0">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <EntireDailyRevenueModal
      isOpen={isEntireRevenueModalOpen}
      onClose={() => setIsEntireRevenueModalOpen(false)}
      data={stats.entireDailyRevenue || []}
    />
  </>
);
}
