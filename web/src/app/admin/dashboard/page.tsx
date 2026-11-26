/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "@/lib/api/dashboard";
import { Users, Activity, TrendingUp, Dumbbell, Loader2, QrCode, UserPlus, Wallet, Clock, XCircle, Cake, Receipt } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
const PendingMembersModal = dynamic(() => import("@/components/dashboard/PendingMembersModal").then((m) => m.PendingMembersModal), { ssr: false });
const ExpiringMembersModal = dynamic(() => import("@/components/dashboard/ExpiringMembersModal").then((m) => m.ExpiringMembersModal), { ssr: false });
const DashboardMembersModal = dynamic(() => import("@/components/dashboard/DashboardMembersModal").then((m) => m.DashboardMembersModal), { ssr: false });

const DashboardChart = dynamic(() => import("@/components/charts/DashboardChart"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Loading chart...</div>
});

export default function DashboardOverview() {
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const [isExpiredModalOpen, setIsExpiredModalOpen] = useState(false);
  const [isActiveMembersModalOpen, setIsActiveMembersModalOpen] = useState(false);
  const [isNewMembersModalOpen, setIsNewMembersModalOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: fetchDashboardStats,
  });

  const stats = data?.data || {
    activeMembers: 0,
    activeMembersList: [],
    monthlyRevenue: 0,
    todaysCheckIns: 0,
    newSignups: 0,
    newMembersList: [],
    todaysCollection: 0,
    expiringIn7Days: 0,
    expiredMembers: 0,
    birthdaysThisMonth: 0,
    todaysBirthdays: [] as {id: string, name: string, memberId: string}[],
    recentActivity: [],
    revenueLast14Days: [],
    recentPaymentsList: [],
    totalPendingAmount: 0,
    pendingMembersList: [],
    expiringMembersList: [],
    expiredMembersList: []
  };

  const statCards = [
    {
      title: "Total Active Members",
      value: stats.activeMembers.toLocaleString(),
      change: "Current total",
      icon: Users,
      onClick: () => setIsActiveMembersModalOpen(true),
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
      onClick: () => setIsExpiringModalOpen(true),
    },
    {
      title: "Expired",
      value: (stats.expiredMembers || 0).toLocaleString(),
      change: "Total expired",
      icon: XCircle,
      onClick: () => setIsExpiredModalOpen(true),
    },
    {
      title: "New This Month",
      value: stats.newSignups.toLocaleString(),
      change: "This month",
      icon: UserPlus,
      onClick: () => setIsNewMembersModalOpen(true),
    },
    {
      title: "Birthdays This Month",
      value: (stats.birthdaysThisMonth || 0).toLocaleString(),
      change: "This month",
      icon: Cake,
    },
    {
      title: "Pending Amount",
      value: `₹${(stats.totalPendingAmount || 0).toLocaleString()}`,
      change: "To collect",
      icon: Receipt,
      onClick: () => setIsPendingModalOpen(true),
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
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm md:text-base">Real-time overview of Lakzee Fitness operations and athlete metrics.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link href="/admin/attendance" className="touch-target gap-2 px-6 rounded-xl border border-brand-gold/60 text-brand-gold hover:bg-brand-gold/10 font-bold transition-all shadow-sm focus-gold w-full sm:w-auto">
            <QrCode className="w-5 h-5" aria-hidden="true" /> Scan QR
          </Link>
          <Link href="/admin/members/new" className="touch-target gap-2 px-6 rounded-xl text-black bg-gradient-to-r from-brand-gold to-yellow-500 hover:brightness-110 font-bold transition-all shadow-lg shadow-brand-gold/20 focus-gold w-full sm:w-auto">
            <UserPlus className="w-5 h-5" aria-hidden="true" /> New Member
          </Link>
        </div>
      </div>

      {/* Connection / Fetch Error Banner */}
      {isError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-destructive"
        >
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to connect to backend service</p>
              <p className="text-xs opacity-90 mt-0.5">
                {error instanceof Error ? error.message : "Unable to reach server. Please ensure the backend server is running on port 5000."}
              </p>
            </div>
          </div>
          <button 
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 transition-colors shrink-0 self-start sm:self-auto"
          >
            Retry Connection
          </button>
        </motion.div>
      )}

      {/* Birthday Notice */}
      {stats.todaysBirthdays && stats.todaysBirthdays.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand-gold/20 via-yellow-500/10 to-transparent border border-brand-gold/30 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Cake className="w-24 h-24 text-brand-gold" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-gold/20 flex items-center justify-center shrink-0 border border-brand-gold/30">
            <Cake className="w-6 h-6 text-brand-gold" />
          </div>
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              🎉 Today&apos;s Birthdays!
            </h3>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Wish a happy birthday to: <span className="text-foreground font-semibold">
                {stats.todaysBirthdays.map((b: any) => `${b.name} (${b.memberId})`).join(', ')}
              </span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            onClick={stat.onClick}
            onKeyDown={(e) => {
              if (stat.onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                stat.onClick();
              }
            }}
            tabIndex={stat.onClick ? 0 : undefined}
            role={stat.onClick ? "button" : undefined}
            aria-label={stat.onClick ? `View details for ${stat.title}` : undefined}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`glass-card p-6 relative overflow-hidden group transition-all duration-300 ${
              stat.onClick 
                ? "cursor-pointer hover:border-brand-gold/60 hover:bg-brand-gold/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-gold/10 focus-gold" 
                : "hover:border-brand-gold/30"
            }`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity">
              <stat.icon className="w-24 h-24 text-brand-gold" aria-hidden="true" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider mb-1 uppercase">{stat.title}</h3>
                <stat.icon className="w-5 h-5 text-brand-gold/60 group-hover:text-brand-gold transition-colors" aria-hidden="true" />
              </div>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
                <span className="text-brand-gold/80 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-gold/10 border border-brand-gold/20">
                  {stat.change}
                </span>
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
          <div className="flex-1 w-full h-full min-h-0 relative">
            {stats.revenueLast14Days && stats.revenueLast14Days.length > 0 ? (
              <DashboardChart data={stats.revenueLast14Days} />
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

      <PendingMembersModal 
        isOpen={isPendingModalOpen} 
        onClose={() => setIsPendingModalOpen(false)} 
        pendingMembers={stats.pendingMembersList} 
      />

      <ExpiringMembersModal
        isOpen={isExpiringModalOpen}
        onClose={() => setIsExpiringModalOpen(false)}
        members={stats.expiringMembersList}
        type="EXPIRING"
      />

      <ExpiringMembersModal
        isOpen={isExpiredModalOpen}
        onClose={() => setIsExpiredModalOpen(false)}
        members={stats.expiredMembersList}
        type="EXPIRED"
      />

      <DashboardMembersModal
        isOpen={isActiveMembersModalOpen}
        onClose={() => setIsActiveMembersModalOpen(false)}
        members={stats.activeMembersList || []}
        type="ACTIVE"
      />

      <DashboardMembersModal
        isOpen={isNewMembersModalOpen}
        onClose={() => setIsNewMembersModalOpen(false)}
        members={stats.newMembersList || []}
        type="NEW"
      />
    </div>
  );
}
