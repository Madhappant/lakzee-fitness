"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReports } from "@/lib/api/reports";
import { TrendingUp, Wallet, Users, CalendarCheck, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Revenue30dModal } from "@/components/reports/Revenue30dModal";
import { ThisMonthPaymentsModal } from "@/components/reports/ThisMonthPaymentsModal";
import { ActiveMembersModal } from "@/components/reports/ActiveMembersModal";

const ReportsCharts = dynamic(() => import("@/components/charts/ReportsCharts"), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center text-muted-foreground mt-8">Loading charts...</div>
});

export default function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: fetchReports });
  const [isRevenue30dModalOpen, setIsRevenue30dModalOpen] = useState(false);
  const [isThisMonthModalOpen, setIsThisMonthModalOpen] = useState(false);
  const [isActiveMembersModalOpen, setIsActiveMembersModalOpen] = useState(false);

  const stats = data?.data || { 
    revenue30d: 0, 
    revenueThisMonth: 0, 
    activeMembers: 0, 
    visits30d: 0,
    dailyRevenue: [],
    dailyVisits: [],
    genderMix: [],
    paymentMix: [],
    dailyRevenue30d: [],
    thisMonthPayments: [],
    activeMembersList: [],
    entireDailyRevenue: []
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-muted-foreground">Last 30 days overview.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Revenue (30D) - Clickable for 30D Graph */}
            <div 
              onClick={() => setIsRevenue30dModalOpen(true)}
              className="glass-panel p-6 border border-border relative overflow-hidden cursor-pointer hover:border-brand-gold/60 transition-all group"
              title="Click to view 30-day revenue graph"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase group-hover:text-brand-gold transition-colors">
                    REVENUE (30D)
                  </h3>
                  <span className="text-[10px] text-muted-foreground group-hover:text-brand-gold/80 transition-colors">
                    Click to view graph ↗
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-brand-gold/10 group-hover:bg-brand-gold/20 transition-colors">
                  <TrendingUp className="w-5 h-5 text-brand-gold" />
                </div>
              </div>
              <p className="text-3xl font-bold text-brand-gold">₹{stats.revenue30d.toLocaleString()}</p>
            </div>
            
            {/* 2. This Month - Clickable for Members & Payments */}
            <div 
              onClick={() => setIsThisMonthModalOpen(true)}
              className="glass-panel p-6 border border-border relative overflow-hidden cursor-pointer hover:border-brand-gold/60 transition-all group"
              title="Click to view members and payments"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase group-hover:text-brand-gold transition-colors">
                    THIS MONTH
                  </h3>
                  <span className="text-[10px] text-muted-foreground group-hover:text-brand-gold/80 transition-colors">
                    Click to view members & payments ↗
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-brand-gold/10 group-hover:bg-brand-gold/20 transition-colors">
                  <Wallet className="w-5 h-5 text-brand-gold" />
                </div>
              </div>
              <p className="text-3xl font-bold text-brand-gold">₹{stats.revenueThisMonth.toLocaleString()}</p>
            </div>

            {/* 3. Active Members - Clickable for Active Members Details */}
            <div 
              onClick={() => setIsActiveMembersModalOpen(true)}
              className="glass-panel p-6 border border-border relative overflow-hidden cursor-pointer hover:border-brand-gold/60 transition-all group"
              title="Click to view active members details"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase group-hover:text-brand-gold transition-colors">
                    ACTIVE MEMBERS
                  </h3>
                  <span className="text-[10px] text-muted-foreground group-hover:text-brand-gold/80 transition-colors">
                    Click to view details ↗
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-brand-gold/15 transition-colors">
                  <Users className="w-5 h-5 text-foreground group-hover:text-brand-gold transition-colors" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.activeMembers.toLocaleString()}</p>
            </div>

            {/* 4. Visits (30D) */}
            <div className="glass-panel p-6 border border-border relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">VISITS (30D)</h3>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CalendarCheck className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-500">{stats.visits30d.toLocaleString()}</p>
            </div>
          </div>

          <ReportsCharts stats={stats} />

          {/* Popups */}
          <Revenue30dModal
            isOpen={isRevenue30dModalOpen}
            onClose={() => setIsRevenue30dModalOpen(false)}
            data={stats.dailyRevenue30d || []}
            totalRevenue={stats.revenue30d || 0}
          />

          <ThisMonthPaymentsModal
            isOpen={isThisMonthModalOpen}
            onClose={() => setIsThisMonthModalOpen(false)}
            payments={stats.thisMonthPayments || []}
            totalRevenue={stats.revenueThisMonth || 0}
          />

          <ActiveMembersModal
            isOpen={isActiveMembersModalOpen}
            onClose={() => setIsActiveMembersModalOpen(false)}
            members={stats.activeMembersList || []}
          />
        </>
      )}
    </div>
  );
}
