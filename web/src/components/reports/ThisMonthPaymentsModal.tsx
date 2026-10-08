/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Wallet, Phone, Calendar, CheckCircle2, Clock } from "lucide-react";

export interface ThisMonthPaymentItem {
  id: string;
  memberId: string;
  memberName: string;
  email?: string;
  phone?: string;
  planName: string;
  planPrice: number;
  amountPaid: number;
  balanceAmount?: number;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

interface ThisMonthPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: ThisMonthPaymentItem[];
  totalRevenue: number;
}

export function ThisMonthPaymentsModal({
  isOpen,
  onClose,
  payments = [],
  totalRevenue = 0,
}: ThisMonthPaymentsModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase().trim();
    return payments.filter(
      (p) =>
        p.memberName?.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.planName?.toLowerCase().includes(q) ||
        p.paymentMethod?.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const filteredTotal = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
  }, [filtered]);

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
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] p-6 md:p-8 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                  <Wallet className="w-6 h-6 text-brand-gold" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    This Month&apos;s Members & Payments
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    All member transactions and collections recorded this month
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

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 shrink-0">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Collected</p>
                <p className="text-xl font-extrabold text-brand-gold mt-0.5">
                  ₹{totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Transactions</p>
                <p className="text-xl font-extrabold text-foreground mt-0.5">
                  {payments.length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Filtered Subtotal</p>
                <p className="text-xl font-extrabold text-green-500 mt-0.5">
                  ₹{filteredTotal.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by member name, ID, phone, plan, or method..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-brand-gold focus:outline-none text-sm transition-colors text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 min-h-0">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No payments found for this month.</p>
                  {search && <p className="text-xs mt-1">Try adjusting your search query.</p>}
                </div>
              ) : (
                filtered.map((item) => {
                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A";
                  const isPaid = item.paymentStatus === "PAID";

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border hover:border-brand-gold/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Left: Member & Plan */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-base">
                            {item.memberName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-brand-gold/10 text-brand-gold font-mono font-semibold border border-brand-gold/20">
                            {item.memberId || "MEMBER"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="text-foreground/90 font-medium">{item.planName}</span>
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              className="flex items-center gap-1 text-muted-foreground hover:text-brand-gold transition-colors"
                            >
                              <Phone className="w-3 h-3 text-brand-gold" />
                              {item.phone}
                            </a>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {dateStr}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount & Badges */}
                      <div className="flex items-center gap-3 shrink-0 self-start md:self-auto flex-wrap">
                        <div className="text-right">
                          <p className="text-lg font-bold text-brand-gold">
                            ₹{item.amountPaid.toLocaleString()}
                          </p>
                          {item.balanceAmount && item.balanceAmount > 0 ? (
                            <p className="text-[11px] text-red-400">
                              Pending: ₹{item.balanceAmount.toLocaleString()}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-md bg-muted border border-border text-foreground">
                            {item.paymentMethod || "CASH"}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-md flex items-center gap-1 border ${
                              isPaid
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            }`}
                          >
                            {isPaid ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            {item.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
