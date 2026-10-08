/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Calendar, Zap, IndianRupee } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DailyPoint {
  date: string;
  name: string;
  fullDate?: string;
  revenue: number;
  count?: number;
}

interface EntireDailyRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DailyPoint[];
}

export function EntireDailyRevenueModal({
  isOpen,
  onClose,
  data = [],
}: EntireDailyRevenueModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setMounted(true), 80);
      return () => clearTimeout(timer);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  const { totalRevenue, peakRevenue, peakDayName, earliestDate, latestDate } = useMemo(() => {
    let total = 0;
    let maxRev = 0;
    let maxDay = "N/A";

    data.forEach((item) => {
      total += item.revenue || 0;
      if (item.revenue > maxRev) {
        maxRev = item.revenue;
        maxDay = item.fullDate || item.name;
      }
    });

    const earliest = data.length > 0 ? (data[0].fullDate || data[0].name) : "N/A";
    const latest = data.length > 0 ? (data[data.length - 1].fullDate || data[data.length - 1].name) : "N/A";

    return {
      totalRevenue: total,
      peakRevenue: maxRev,
      peakDayName: maxDay,
      earliestDate: earliest,
      latestDate: latest,
    };
  }, [data]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] p-6 md:p-8 rounded-2xl bg-card border border-border shadow-2xl overflow-y-auto custom-scrollbar flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                  <TrendingUp className="w-6 h-6 text-brand-gold" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    Complete Historical Daily Revenue Curve
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    Entire timeline from {earliestDate} to {latestDate}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 shrink-0">
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-brand-gold" />
                  All-Time Revenue
                </div>
                <p className="text-xl md:text-2xl font-extrabold text-brand-gold">
                  ₹{totalRevenue.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-1">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  Peak Single Day
                </div>
                <p className="text-xl md:text-2xl font-extrabold text-blue-400">
                  ₹{peakRevenue.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={peakDayName}>
                  {peakDayName}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-1">
                  <Calendar className="w-3.5 h-3.5 text-green-400" />
                  Earliest Record
                </div>
                <p className="text-sm md:text-base font-bold text-foreground truncate mt-1" title={earliestDate}>
                  {earliestDate}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  Latest Record
                </div>
                <p className="text-sm md:text-base font-bold text-foreground truncate mt-1" title={latestDate}>
                  {latestDate}
                </p>
              </div>
            </div>

            {/* Entire Daily Revenue Graph (Exact same AreaChart design) */}
            <div className="w-full p-4 rounded-xl bg-muted/20 border border-border flex flex-col shrink-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  Complete Historical Daily Revenue Curve
                </span>
                <span className="text-xs text-brand-gold font-medium">
                  {data.length} recorded daily data points
                </span>
              </div>
              <div className="w-full h-[320px] md:h-[380px] relative">
                {mounted ? (
                  <ResponsiveContainer key={`entire-${isOpen}-${data.length}`} width="100%" height={360}>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenueEntireModal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, (dataMax: number) => (dataMax > 0 ? dataMax : 1000)]}
                        tickFormatter={(value) => `₹${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "10px",
                          color: "var(--foreground)",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                        }}
                        itemStyle={{ color: "#D4AF37", fontWeight: "bold" }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Revenue"]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullDate || label;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#D4AF37"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenueEntireModal)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Loading graph...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
