"use client";

import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ['#D4AF37', '#ffffff', '#eab308'];

export default function ReportsCharts({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Daily Revenue Chart */}
      <div className="glass-panel p-6 border border-border h-80 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Daily Revenue</h2>
        <div className="flex-1 w-full h-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.dailyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                itemStyle={{ color: '#D4AF37' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Visits Chart */}
      <div className="glass-panel p-6 border border-border h-80 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Daily Visits</h2>
        <div className="flex-1 w-full h-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dailyVisits} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                itemStyle={{ color: '#22c55e' }}
                cursor={{ fill: 'var(--muted)' }}
              />
              <Bar dataKey="visits" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Method Mix */}
      <div className="glass-panel p-6 border border-border h-80 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Payment Method Mix (30d)</h2>
        <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.paymentMix} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {stats.paymentMix.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
            </PieChart>
          </ResponsiveContainer>
          {/* Custom Legend */}
          <div className="absolute right-4 flex flex-col gap-3">
            {stats.paymentMix.map((item: any, i: number) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-bold text-foreground ml-2">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gender Mix */}
      <div className="glass-panel p-6 border border-border h-80 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Gender Mix</h2>
        <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.genderMix} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {stats.genderMix.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute right-4 flex flex-col gap-3">
            {stats.genderMix.map((item: any, i: number) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-bold text-foreground ml-2">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
