/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "@/lib/api/dashboard";
import {
  Users,
  Activity,
  TrendingUp,
  Dumbbell,
  Loader2,
  QrCode,
  UserPlus,
  Wallet,
  Clock,
  XCircle,
  Cake,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PendingMembersModal = dynamic(
  () => import("@/components/dashboard/PendingMembersModal").then((m) => m.PendingMembersModal),
  { ssr: false }
);
const ExpiringMembersModal = dynamic(
  () => import("@/components/dashboard/ExpiringMembersModal").then((m) => m.ExpiringMembersModal),
  { ssr: false }
);
const DashboardMembersModal = dynamic(
  () => import("@/components/dashboard/DashboardMembersModal").then((m) => m.DashboardMembersModal),
  { ssr: false }
);

const DashboardChart = dynamic(() => import("@/components/charts/DashboardChart"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center font-mono-metric text-xs text-muted-foreground">
      Loading revenue series...
    </div>
  ),
});

const SUBTLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function DashboardOverview() {
  const shouldReduceMotion = useReducedMotion();
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
    todaysBirthdays: [] as { id: string; name: string; memberId: string }[],
    recentActivity: [],
    revenueLast14Days: [],
    recentPaymentsList: [],
    totalPendingAmount: 0,
    pendingMembersList: [],
    expiringMembersList: [],
    expiredMembersList: [],
  };

  // Asymmetric Bento span choreography preserving all 9 metrics & click handlers
  const bentoCards = [
    {
      title: "Monthly Revenue",
      value: `₹${stats.monthlyRevenue.toLocaleString()}`,
      tag: "This month",
      icon: TrendingUp,
      spanClass: "sm:col-span-2 lg:col-span-5",
      featured: true,
    },
    {
      title: "Total Active Members",
      value: stats.activeMembers.toLocaleString(),
      tag: "Current total",
      icon: Users,
      spanClass: "sm:col-span-1 lg:col-span-4",
      onClick: () => setIsActiveMembersModalOpen(true),
    },
    {
      title: "Today's Collection",
      value: `₹${(stats.todaysCollection || 0).toLocaleString()}`,
      tag: "Today",
      icon: Wallet,
      spanClass: "sm:col-span-1 lg:col-span-3",
    },
    {
      title: "Today's Attendance",
      value: stats.todaysCheckIns.toLocaleString(),
      tag: "Today",
      icon: Activity,
      spanClass: "sm:col-span-1 lg:col-span-3",
    },
    {
      title: "New This Month",
      value: stats.newSignups.toLocaleString(),
      tag: "This month",
      icon: UserPlus,
      spanClass: "sm:col-span-1 lg:col-span-3",
      onClick: () => setIsNewMembersModalOpen(true),
    },
    {
      title: "Expiring in 7 Days",
      value: (stats.expiringIn7Days || 0).toLocaleString(),
      tag: "Next 7 days",
      icon: Clock,
      spanClass: "sm:col-span-1 lg:col-span-3",
      onClick: () => setIsExpiringModalOpen(true),
    },
    {
      title: "Pending Amount",
      value: `₹${(stats.totalPendingAmount || 0).toLocaleString()}`,
      tag: "To collect",
      icon: Receipt,
      spanClass: "sm:col-span-1 lg:col-span-3",
      onClick: () => setIsPendingModalOpen(true),
    },
    {
      title: "Expired",
      value: (stats.expiredMembers || 0).toLocaleString(),
      tag: "Total expired",
      icon: XCircle,
      spanClass: "sm:col-span-1 lg:col-span-6",
      onClick: () => setIsExpiredModalOpen(true),
      compact: true,
    },
    {
      title: "Birthdays This Month",
      value: (stats.birthdaysThisMonth || 0).toLocaleString(),
      tag: "This month",
      icon: Cake,
      spanClass: "sm:col-span-1 lg:col-span-6",
      compact: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#D4FF00]" aria-hidden="true" />
          <span className="font-mono-metric text-xs text-muted-foreground tracking-widest uppercase">
            Loading Studio Metrics
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Studio Overview Header */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: SUBTLE_EASE }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-5 pb-6 border-b border-border"
      >
        <div className="space-y-1.5">
          <p className="font-mono-metric text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Operations Telemetry
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time overview of Lakzee Fitness operations and athlete metrics.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/admin/attendance"
            className="touch-target gap-2 px-5 rounded-xl border border-border bg-secondary/40 text-foreground hover:border-[#D4FF00]/50 hover:bg-secondary font-semibold text-sm transition-colors duration-200 focus-volt w-full sm:w-auto"
          >
            <QrCode className="w-4 h-4 text-[#D4FF00]" aria-hidden="true" />
            Scan QR
          </Link>
          <Link
            href="/admin/members/new"
            className="touch-target gap-2 px-5 rounded-xl bg-[#D4FF00] text-[#0A0A0C] hover:brightness-105 font-bold text-sm transition-all duration-200 volt-glow-sm focus-volt w-full sm:w-auto"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            New Member
          </Link>
        </div>
      </motion.div>

      {/* Connection / Fetch Error Banner */}
      {isError && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 rounded-2xl bg-secondary border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4 text-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Failed to connect to backend service</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {error instanceof Error
                  ? error.message
                  : "Unable to reach server. Please ensure the backend server is running on port 5000."}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="touch-target px-4 rounded-xl bg-[#D4FF00] text-[#0A0A0C] text-xs font-bold hover:brightness-105 transition-all shrink-0 self-start sm:self-auto focus-volt"
          >
            Retry Connection
          </button>
        </motion.div>
      )}

      {/* Birthday Notice */}
      {stats.todaysBirthdays && stats.todaysBirthdays.length > 0 && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl p-4 md:p-5 bg-[#D4FF00]/[0.06] border border-[#D4FF00]/25 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center shrink-0">
            <Cake className="w-5 h-5 text-[#D4FF00]" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-foreground">
              Today&apos;s Birthdays
            </h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Wish a happy birthday to:{" "}
              <span className="text-foreground font-medium">
                {stats.todaysBirthdays.map((b: any) => `${b.name} (${b.memberId})`).join(", ")}
              </span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Asymmetric Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
        {bentoCards.map((stat, i) => {
          const Icon = stat.icon;
          const clickable = Boolean(stat.onClick);

          return (
            <motion.div
              key={stat.title}
              onClick={stat.onClick}
              onKeyDown={(e) => {
                if (stat.onClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  stat.onClick();
                }
              }}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? "button" : undefined}
              aria-label={clickable ? `View details for ${stat.title}` : undefined}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.24,
                delay: shouldReduceMotion ? 0 : Math.min(i * 0.03, 0.24),
                ease: SUBTLE_EASE,
              }}
              className={`${stat.spanClass} group relative rounded-2xl border transition-all duration-200 ${
                stat.featured
                  ? "bg-card border-[#D4FF00]/30 hover:border-[#D4FF00]/60 p-6"
                  : stat.compact
                  ? "glass-card p-5 flex items-center justify-between gap-4"
                  : "glass-card p-6"
              } ${
                clickable
                  ? "cursor-pointer hover:-translate-y-0.5 hover:border-[#D4FF00]/50 hover:bg-secondary/50 focus-volt"
                  : "hover:border-foreground/15"
              }`}
            >
              {stat.compact ? (
                <>
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                      <Icon
                        className={`w-4 h-4 ${clickable ? "text-[#D4FF00]" : "text-foreground/75"}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-medium text-muted-foreground truncate">
                        {stat.title}
                      </h3>
                      <p className="font-mono-metric text-[11px] text-muted-foreground/70 mt-0.5">
                        {stat.tag}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-mono-metric text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                      {stat.value}
                    </p>
                    {clickable && (
                      <ArrowUpRight
                        className="w-4 h-4 text-muted-foreground group-hover:text-[#D4FF00] transition-colors"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col justify-between h-full gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground tracking-wide">
                        {stat.title}
                      </h3>
                      <span
                        className={`inline-block font-mono-metric text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                          stat.featured
                            ? "bg-[#D4FF00]/12 text-[#D4FF00] border-[#D4FF00]/25"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}
                      >
                        {stat.tag}
                      </span>
                    </div>

                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
                        stat.featured
                          ? "bg-[#D4FF00] text-[#0A0A0C] border-[#D4FF00]"
                          : clickable
                          ? "bg-secondary border-border text-foreground/75 group-hover:border-[#D4FF00]/40 group-hover:text-[#D4FF00]"
                          : "bg-secondary border-border text-muted-foreground"
                      }`}
                    >
                      {clickable && !stat.featured ? (
                        <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  <p
                    className={`font-mono-metric font-bold tracking-tight ${
                      stat.featured
                        ? "text-3xl sm:text-4xl text-[#D4FF00]"
                        : "text-2xl sm:text-3xl text-foreground"
                    }`}
                  >
                    {stat.value}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Charts & Feeds Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Revenue Chart */}
        <div className="lg:col-span-6 xl:col-span-5 glass-panel p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-6 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Revenue Last 14 Days
              </h2>
              <p className="font-mono-metric text-[11px] text-muted-foreground mt-0.5">
                Daily subscription & balance collections
              </p>
            </div>
            <span className="font-mono-metric text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#D4FF00]/10 text-[#D4FF00] border border-[#D4FF00]/25">
              14D Series
            </span>
          </div>
          <div className="flex-1 w-full min-h-0 relative">
            {stats.revenueLast14Days && stats.revenueLast14Days.length > 0 ? (
              <DashboardChart data={stats.revenueLast14Days} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center font-mono-metric text-xs text-muted-foreground">
                Chart data will appear here
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments Feed */}
        <div className="lg:col-span-6 xl:col-span-4 glass-panel p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-6 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Recent Payments
              </h2>
              <p className="font-mono-metric text-[11px] text-muted-foreground mt-0.5">
                Latest cleared transactions
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-2.5">
            {!stats.recentPaymentsList || stats.recentPaymentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Receipt className="w-7 h-7 opacity-40 mb-2" aria-hidden="true" />
                <p className="text-sm">No recent payments to show</p>
              </div>
            ) : (
              stats.recentPaymentsList.map((payment: any) => {
                const date = new Date(payment.date);
                const timeAgo = Math.round((new Date().getTime() - date.getTime()) / 60000);
                const displayTime =
                  timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.floor(timeAgo / 60)} hours ago`;
                return (
                  <div
                    key={payment.id}
                    className="p-3.5 rounded-xl bg-secondary/40 border border-border hover:border-foreground/15 transition-colors duration-200 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {payment.memberName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {payment.planName} ·{" "}
                        <span className="font-mono-metric">{displayTime}</span>
                      </p>
                    </div>
                    <p className="font-mono-metric text-sm font-bold text-[#D4FF00] shrink-0">
                      ₹{payment.amount}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-12 xl:col-span-3 glass-panel p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-6 shrink-0">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Recent Activity
              </h2>
              <p className="font-mono-metric text-[11px] text-muted-foreground mt-0.5">
                Live studio events
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-5">
            {!stats.recentActivity || stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No recent activity.</p>
            ) : (
              stats.recentActivity.map((activity: any, i: number) => {
                const date = new Date(activity.time);
                const timeAgo = Math.round((new Date().getTime() - date.getTime()) / 60000);
                const displayTime =
                  timeAgo < 60 ? `${timeAgo} mins ago` : `${Math.floor(timeAgo / 60)} hours ago`;

                return (
                  <div
                    key={activity.id || i}
                    className="flex gap-3.5 relative before:absolute before:left-[17px] before:top-9 before:bottom-[-20px] before:w-px before:bg-border last:before:hidden"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#D4FF00]/10 flex items-center justify-center shrink-0 border border-[#D4FF00]/25">
                      <Dumbbell className="w-3.5 h-3.5 text-[#D4FF00]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground leading-snug">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.description} ·{" "}
                        <span className="font-mono-metric text-foreground/75">{displayTime}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Existing Modals — State & Props Preserved */}
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
