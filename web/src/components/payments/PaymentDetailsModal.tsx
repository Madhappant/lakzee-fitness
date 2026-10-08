"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Phone, Wallet, CalendarRange, ListTree, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type PaymentModalType = "TODAY" | "THIS_MONTH" | "PENDING" | "TOTAL";

interface SubscriptionItem {
  id: string;
  memberId: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  balanceAmount?: number;
  createdAt: string;
  plan?: {
    id: string;
    name: string;
    price: number;
    durationDays?: number;
  };
  member?: {
    id: string;
    memberId: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
}

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: PaymentModalType | null;
  subscriptions: SubscriptionItem[];
}

export function PaymentDetailsModal({
  isOpen,
  onClose,
  type,
  subscriptions = []
}: PaymentDetailsModalProps) {
  const [search, setSearch] = useState("");

  const modalConfig = useMemo(() => {
    switch (type) {
      case "TODAY":
        return {
          title: "Today's Collection",
          subtitle: "Members and payments collected today",
          icon: Wallet,
          colorClass: "text-green-500",
          bgClass: "bg-green-500/10",
          borderClass: "border-green-500/20"
        };
      case "THIS_MONTH":
        return {
          title: "This Month's Collection",
          subtitle: "Members and payments collected this month",
          icon: CalendarRange,
          colorClass: "text-brand-gold",
          bgClass: "bg-brand-gold/10",
          borderClass: "border-brand-gold/20"
        };
      case "PENDING":
        return {
          title: "Pending Amount & Members",
          subtitle: "Members with outstanding dues or pending payments",
          icon: AlertCircle,
          colorClass: "text-red-500",
          bgClass: "bg-red-500/10",
          borderClass: "border-red-500/20"
        };
      case "TOTAL":
      default:
        return {
          title: "Total Subscription Records",
          subtitle: "Complete member payment and subscription history",
          icon: ListTree,
          colorClass: "text-foreground",
          bgClass: "bg-muted",
          borderClass: "border-border"
        };
    }
  }, [type]);

  const items = useMemo(() => {
    if (!type) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    switch (type) {
      case "TODAY":
        return subscriptions.filter((sub) => {
          const d = new Date(sub.createdAt);
          if (d < today) return false;
          const price = sub.plan?.price || 0;
          if (sub.paymentStatus === "PAID") return true;
          if (sub.paymentStatus === "PENDING") {
            const bal = sub.balanceAmount || 0;
            return bal > 0 && price > bal;
          }
          return false;
        });

      case "THIS_MONTH":
        return subscriptions.filter((sub) => {
          const d = new Date(sub.createdAt);
          if (d < firstDayOfMonth) return false;
          const price = sub.plan?.price || 0;
          if (sub.paymentStatus === "PAID") return true;
          if (sub.paymentStatus === "PENDING") {
            const bal = sub.balanceAmount || 0;
            return bal > 0 && price > bal;
          }
          return false;
        });

      case "PENDING":
        return subscriptions.filter((sub) => {
          if (sub.paymentStatus === "PENDING") return true;
          const bal = sub.balanceAmount || 0;
          return bal > 0;
        });

      case "TOTAL":
      default:
        return subscriptions;
    }
  }, [type, subscriptions]);

  const summary = useMemo(() => {
    let totalAmount = 0;
    items.forEach((sub) => {
      const price = sub.plan?.price || 0;
      if (type === "PENDING") {
        const bal = sub.balanceAmount || 0;
        totalAmount += bal > 0 ? bal : price;
      } else {
        if (sub.paymentStatus === "PAID") {
          totalAmount += price;
        } else if (sub.paymentStatus === "PENDING") {
          const bal = sub.balanceAmount || 0;
          if (bal > 0) totalAmount += Math.max(0, price - bal);
        }
      }
    });

    return {
      count: items.length,
      amount: totalAmount
    };
  }, [items, type]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();

    return items.filter((sub) => {
      const name = `${sub.member?.user?.firstName || ""} ${sub.member?.user?.lastName || ""}`.toLowerCase();
      const memberId = (sub.member?.memberId || "").toLowerCase();
      const phone = (sub.member?.user?.phone || "").toLowerCase();
      const email = (sub.member?.user?.email || "").toLowerCase();
      const planName = (sub.plan?.name || "").toLowerCase();
      const method = (sub.paymentMethod || "").toLowerCase();
      const pStatus = (sub.paymentStatus || "").toLowerCase();

      return (
        name.includes(q) ||
        memberId.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        planName.includes(q) ||
        method.includes(q) ||
        pStatus.includes(q)
      );
    });
  }, [items, search]);

  if (!type) return null;

  const Icon = modalConfig.icon;

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
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${modalConfig.bgClass} ${modalConfig.colorClass}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {modalConfig.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modalConfig.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Banner */}
            <div className="mb-4 p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Total: <strong className="text-foreground">{summary.count}</strong> records</span>
              </div>
              {type !== "TOTAL" && (
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-xs text-muted-foreground font-normal">
                    {type === "PENDING" ? "Total Due:" : "Collected:"}
                  </span>
                  <span className={modalConfig.colorClass}>
                    ₹{summary.amount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-4 shrink-0">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by member name, Member No, phone, plan or method..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:border-brand-gold outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 -mx-6 px-6">
              {filteredItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">
                    {search ? "No matching records found" : "No records to display"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-2">
                  {filteredItems.map((sub) => {
                    const firstName = sub.member?.user?.firstName || "Unknown";
                    const lastName = sub.member?.user?.lastName || "Member";
                    const fullName = `${firstName} ${lastName}`.trim();
                    const memberNo = sub.member?.memberId || "N/A";
                    const phone = sub.member?.user?.phone;
                    const planName = sub.plan?.name || "Membership Plan";
                    const price = sub.plan?.price || 0;
                    const method = sub.paymentMethod || "CASH";
                    const isPaid = sub.paymentStatus === "PAID";
                    const isPending = sub.paymentStatus === "PENDING";
                    const balance = sub.balanceAmount || (isPending ? price : 0);
                    const paidAmount = isPaid ? price : Math.max(0, price - balance);
                    const createdDate = new Date(sub.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    const startDate = new Date(sub.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short"
                    });
                    const endDate = new Date(sub.endDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        {/* Member Details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-base">
                              {fullName}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-brand-gold font-semibold border border-border">
                              {memberNo}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Plan: <strong className="text-foreground/80">{planName}</strong></span>
                            <span>•</span>
                            <span>Date: {createdDate}</span>
                          </p>

                          <div className="flex items-center gap-3 pt-0.5">
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-gold transition-colors"
                              >
                                <Phone className="w-3 h-3" /> {phone}
                              </a>
                            )}
                            <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                              Method: {method}
                            </span>
                          </div>
                        </div>

                        {/* Payment / Status Details */}
                        <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                          {type === "PENDING" ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Pending Due:</span>
                                <span className="text-base font-bold text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                                  ₹{balance.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Total Plan: ₹{price.toLocaleString()} {paidAmount > 0 && `(Paid: ₹${paidAmount.toLocaleString()})`}
                              </p>
                            </>
                          ) : type === "TOTAL" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  ₹{price.toLocaleString()}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                                    isPaid
                                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                                      : "bg-red-500/10 text-red-400 border-red-500/20"
                                  }`}
                                >
                                  {isPaid ? "PAID" : `DUE ₹${balance.toLocaleString()}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{startDate} → {endDate}</span>
                                <span
                                  className={`ml-1 px-1.5 py-0.2 rounded text-[10px] ${
                                    sub.status === "ACTIVE"
                                      ? "bg-green-500/10 text-green-400"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Collected:</span>
                                <span className="text-base font-bold text-green-500 bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                                  ₹{paidAmount.toLocaleString()}
                                </span>
                              </div>
                              {isPending && balance > 0 && (
                                <p className="text-[11px] text-red-400">
                                  Balance Due: ₹{balance.toLocaleString()}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
