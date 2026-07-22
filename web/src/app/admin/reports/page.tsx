"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReports } from "@/lib/api/reports";
import { TrendingUp, Wallet, Users, CalendarCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const ReportsCharts = dynamic(() => import("@/components/charts/ReportsCharts"), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center text-muted-foreground mt-8">Loading charts...</div>
});

export default function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: fetchReports });
  const stats = data?.data || { 
    revenue30d: 0, 
    revenueThisMonth: 0, 
    activeMembers: 0, 
    visits30d: 0,
    dailyRevenue: [],
    dailyVisits: [],
    genderMix: [],
    paymentMix: []
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
            <div className="glass-panel p-6 border border-border relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">REVENUE (30D)</h3>
                <TrendingUp className="w-5 h-5 text-brand-gold/50" />
              </div>
              <p className="text-3xl font-bold text-brand-gold">₹{stats.revenue30d.toLocaleString()}</p>
            </div>
            
            <div className="glass-panel p-6 border border-border relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">THIS MONTH</h3>
                <Wallet className="w-5 h-5 text-brand-gold/50" />
              </div>
              <p className="text-3xl font-bold text-brand-gold">₹{stats.revenueThisMonth.toLocaleString()}</p>
            </div>

            <div className="glass-panel p-6 border border-border relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">ACTIVE MEMBERS</h3>
                <Users className="w-5 h-5 text-white/50" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.activeMembers.toLocaleString()}</p>
            </div>

            <div className="glass-panel p-6 border border-border relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-bold tracking-wider mb-1 uppercase">VISITS (30D)</h3>
                <CalendarCheck className="w-5 h-5 text-green-500/50" />
              </div>
              <p className="text-3xl font-bold text-green-500">{stats.visits30d.toLocaleString()}</p>
            </div>
          </div>

          <ReportsCharts stats={stats} />
        </>
      )}
    </div>
  );
}
