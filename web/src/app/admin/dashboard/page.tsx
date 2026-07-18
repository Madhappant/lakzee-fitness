"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "@/lib/api/dashboard";
import { Users, CreditCard, Activity, TrendingUp, Dumbbell, Loader2, QrCode, UserPlus, Wallet, Clock, XCircle, Cake, Receipt } from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: fetchDashboardStats,
  });

  const stats = data?.data || {
    activeMembers: 0,
    monthlyRevenue: 0,
    todaysCheckIns: 0,
    newSignups: 0,
    todaysCollection: 0,
    expiringIn7Days: 0,
    expiredMembers: 0,
    birthdaysThisMonth: 0,
    recentActivity: [],
    revenueLast14Days: [],
    recentPaymentsList: []
  };

  const statCards = [
    {
      title: "Total Active Members",
      value: stats.activeMembers.toLocaleString(),
      change: "Current total",
      icon: Users,
    },
    {
      title: "Today's Attendance",
      value: stats.todaysCheckIns.toLocaleString(),
      change: "Today",
      icon: Activity,
    },
    {
      title: "Today's Collection",
      value: `₹${(stats.todaysCollection || 0).toLocaleString()}`,
      change: "Today",
      icon: Wallet,
    },
    {
      title: "Monthly Revenue",
      value: `₹${stats.monthlyRevenue.toLocaleString()}`,
      change: "This month",
      icon: TrendingUp,
    },
    {
      title: "Expiring in 7 Days",
      value: (stats.expiringIn7Days || 0).toLocaleString(),
      change: "Next 7 days",
      icon: Clock,
    },
    {
      title: "Expired",
      value: (stats.expiredMembers || 0).toLocaleString(),
      change: "Total expired",
      icon: XCircle,
    },
    {
      title: "New This Month",
      value: stats.newSignups.toLocaleString(),
      change: "This month",
      icon: UserPlus,
    },
    {
      title: "Birthdays This Month",
      value: (stats.birthdaysThisMonth || 0).toLocaleString(),
      change: "This month",
      icon: Cake,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Here is what's happening at Lakzee Fitness Studio today.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/attendance" className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-brand-gold text-brand-gold hover:bg-brand-gold/10 font-semibold transition-colors">
            <QrCode className="w-5 h-5" /> Scan QR
          </Link>
          <Link href="/admin/members" className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-primary-foreground bg-brand-gold hover:bg-yellow-500 font-semibold transition-colors">
            <UserPlus className="w-5 h-5" /> New Member
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-6 relative overflow-hidden group hover:border-brand-gold/30 transition-colors"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon className="w-24 h-24 text-brand-gold" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">{stat.title}</h3>
                <stat.icon className="w-5 h-5 text-brand-gold/50" />
              </div>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-brand-gold/60 text-xs font-medium uppercase tracking-wider">{stat.change}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="glass-panel p-6 border border-border flex flex-col h-96">
          <h2 className="text-xl font-bold mb-6">Revenue Last 14 days</h2>
          <div className="flex-1 w-full h-full min-h-0">
            {stats.revenueLast14Days && stats.revenueLast14Days.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueLast14Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDashboardRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={3} fillOpacity={1} fill="url(#colorDashboardRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                Chart data will appear here
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="glass-panel p-6 border border-border flex flex-col h-96">
          <h2 className="text-xl font-bold mb-6">Recent Payments</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {!stats.recentPaymentsList || stats.recentPaymentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Receipt className="w-8 h-8 opacity-50 mb-2" />
                <p className="text-sm">No recent payments to show</p>
              </div>
            ) : (
              stats.recentPaymentsList.map((payment: any, i: number) => {
                const date = new Date(payment.date);
                const timeAgo = Math.round((new Date().getTime() - date.getTime()) / 60000);
                const displayTime = timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.floor(timeAgo / 60)} hours ago`;
                return (
                  <motion.div 
                    key={payment.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl bg-muted/50 border border-border flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{payment.memberName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{payment.planName} • {displayTime}</p>
                    </div>
                    <p className="font-bold text-brand-gold">₹{payment.amount}</p>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel p-6 border border-border flex flex-col h-96">
          <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            {!stats.recentActivity || stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No recent activity.</p>
            ) : (
              stats.recentActivity.map((activity: any, i: number) => {
                const date = new Date(activity.time);
                const timeAgo = Math.round((new Date().getTime() - date.getTime()) / 60000);
                const displayTime = timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.floor(timeAgo / 60)} hours ago`;

                return (
                  <motion.div 
                    key={activity.id || i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 relative before:absolute before:left-[19px] before:top-10 before:bottom-[-24px] before:w-px before:bg-border last:before:hidden"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0 border border-brand-gold/20">
                      <Dumbbell className="w-4 h-4 text-brand-gold" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{activity.title}</p>
                      <p className="text-sm text-brand-gold mt-1">
                        {activity.description} • {displayTime}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
