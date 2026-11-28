/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSubscriptions, createSubscription, fetchPaymentStats, updateSubscription, deleteSubscription } from "@/lib/api/subscriptions";
import { downloadPaymentReceipt, fetchOnlinePayments } from "@/lib/api/payments";
import { fetchMembers } from "@/lib/api/members";
import { fetchPlans } from "@/lib/api/plans";
import { useBranchScope } from "@/lib/branch-context";
import { Plus, X, Loader2, Calendar as CalendarIcon, CheckCircle2, CalendarRange, Wallet, ListTree, Edit2, Trash2, Save, Search, Download, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { PaymentModalType } from "@/components/payments/PaymentDetailsModal";

const PaymentDetailsModal = dynamic(
  () => import("@/components/payments/PaymentDetailsModal").then((mod) => mod.PaymentDetailsModal),
  { ssr: false }
);

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { activeBranchId } = useBranchScope();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ASSIGN" | "EDIT">("ASSIGN");
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [activeDetailsModal, setActiveDetailsModal] = useState<PaymentModalType | null>(null);
  const [modalError, setModalError] = useState("");
  const [formData, setFormData] = useState({
    memberId: "",
    planId: "",
    startDate: new Date().toISOString().split('T')[0], // Today's date by default
    status: "ACTIVE",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    balanceAmount: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [paymentFilter, setPaymentFilter] = useState("All Payments");
  const [activeTab, setActiveTab] = useState<"SUBSCRIPTIONS" | "ONLINE">("SUBSCRIPTIONS");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Fetching Data
  const { data: subsData, isLoading: loadingSubs, isError: subsError } = useQuery({ 
    queryKey: ["subscriptions", activeBranchId], 
    queryFn: () => fetchSubscriptions() 
  });
  const { data: onlinePaymentsData, isLoading: loadingOnline } = useQuery({
    queryKey: ["onlinePayments", activeBranchId],
    queryFn: () => fetchOnlinePayments({ limit: 150 }),
  });
  const { data: statsData } = useQuery({ queryKey: ["paymentStats", activeBranchId], queryFn: fetchPaymentStats });
  const { data: membersData } = useQuery({ queryKey: ["members", activeBranchId], queryFn: fetchMembers });
  const { data: plansData } = useQuery({ queryKey: ["plans", activeBranchId], queryFn: fetchPlans });

  const subscriptions = useMemo(() => subsData?.data ?? [], [subsData?.data]);
  const onlineTransactions = useMemo(() => onlinePaymentsData?.data ?? [], [onlinePaymentsData?.data]);
  const stats = statsData?.data || { todaysCollection: 0, thisMonth: 0, totalRecords: 0, totalPending: 0 };
  const members = membersData?.data || [];
  const plans = plansData?.data || [];
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredOnlineTransactions = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return onlineTransactions.filter((pay) => {
      const fullName = `${pay.member?.user?.firstName || ""} ${pay.member?.user?.lastName || ""}`.toLowerCase();
      const memberCode = (pay.member?.memberId || "").toLowerCase();
      const invoice = (pay.invoiceNumber || "").toLowerCase();
      const planName = (pay.plan?.name || "").toLowerCase();
      const method = (pay.method || "").toLowerCase();
      const txn = (pay.razorpayPaymentId || pay.razorpayOrderId || "").toLowerCase();
      return (
        !q ||
        fullName.includes(q) ||
        memberCode.includes(q) ||
        invoice.includes(q) ||
        planName.includes(q) ||
        method.includes(q) ||
        txn.includes(q)
      );
    });
  }, [onlineTransactions, deferredSearch]);

  const handleDownloadReceipt = async (paymentId: string, invoiceNumber?: string | null) => {
    setDownloadingReceiptId(paymentId);
    try {
      await downloadPaymentReceipt(paymentId, `Receipt-${invoiceNumber || paymentId.slice(0, 8)}.pdf`);
      toast.success("Receipt PDF downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download PDF receipt");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const filteredSubscriptions = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return subscriptions.filter((sub: any) => {
      const firstName = sub.member?.user?.firstName || "";
      const lastName = sub.member?.user?.lastName || "";
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const memberId = (sub.member?.memberId || "").toLowerCase();
      const email = (sub.member?.user?.email || "").toLowerCase();
      const phone = (sub.member?.user?.phone || "").toLowerCase();
      const planName = (sub.plan?.name || "").toLowerCase();
      const method = (sub.paymentMethod || "").toLowerCase();

      const matchesSearch = !q || 
        fullName.includes(q) || 
        memberId.includes(q) || 
        email.includes(q) || 
        phone.includes(q) || 
        planName.includes(q) || 
        method.includes(q);

      let matchesStatus = true;
      if (statusFilter === "Active") matchesStatus = sub.status === "ACTIVE";
      if (statusFilter === "Expired") matchesStatus = sub.status === "EXPIRED";

      let matchesPayment = true;
      if (paymentFilter === "Paid") matchesPayment = sub.paymentStatus === "PAID";
      if (paymentFilter === "Pending") matchesPayment = sub.paymentStatus === "PENDING";

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [subscriptions, deferredSearch, statusFilter, paymentFilter]);

  const invalidateFinanceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["paymentStats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const mutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      invalidateFinanceQueries();
      toast.success("Plan assigned successfully!");
      setIsModalOpen(false);
      setModalError("");
      setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID", paymentMethod: "CASH", balanceAmount: "" });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to assign subscription";
      setModalError(msg);
      toast.error(msg);
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateSubscription(selectedSubId!, data),
    onSuccess: () => {
      invalidateFinanceQueries();
      toast.success("Subscription updated successfully!");
      setIsModalOpen(false);
      setModalError("");
      setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID", paymentMethod: "CASH", balanceAmount: "" });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to update subscription";
      setModalError(msg);
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      invalidateFinanceQueries();
      toast.success("Subscription deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete subscription");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (modalMode === "EDIT") {
      updateMut.mutate(formData);
    } else {
      mutation.mutate(formData);
    }
  };

  const handlePlanOrDateChange = (field: 'planId' | 'startDate', value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      const plan = plans.find((p: any) => p.id === newData.planId);
      
      if (plan && newData.startDate) {
        const start = new Date(newData.startDate);
        if (!isNaN(start.getTime())) {
          const end = new Date(start);
          end.setDate(end.getDate() + plan.durationDays);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (end >= today && newData.status === 'EXPIRED') {
             newData.status = 'ACTIVE';
          } else if (end < today && newData.status === 'ACTIVE') {
             newData.status = 'EXPIRED';
          }
        }
      }
      return newData;
    });
  };

  const handleEdit = (sub: any) => {
    setModalError("");
    setModalMode("EDIT");
    setSelectedSubId(sub.id);
    setFormData({
      memberId: sub.memberId,
      planId: sub.planId,
      startDate: sub.startDate && !isNaN(new Date(sub.startDate).getTime()) ? new Date(sub.startDate).toISOString().split('T')[0] : "",
      status: sub.status,
      paymentStatus: sub.paymentStatus || "PAID",
      paymentMethod: sub.paymentMethod || "CASH",
      balanceAmount: sub.balanceAmount || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this subscription?")) {
      deleteMut.mutate(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          role="button"
          tabIndex={0}
          aria-label="View Today's Collection members and payments"
          onClick={() => setActiveDetailsModal("TODAY")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveDetailsModal("TODAY");
            }
          }}
          className="apple-glass p-6 relative overflow-hidden group hover:border-[#DBA12C]/55 hover:-translate-y-1 hover:shadow-xl cursor-pointer transition-all duration-300 focus-gold rounded-2xl"
        >
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-xs font-bold tracking-wider mb-1 uppercase">Today&apos;s Collection</h3>
            <Wallet className="w-5 h-5 text-[#DBA12C]/70 group-hover:text-[#F2C14E] transition-colors" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-[#F2C14E]">₹{stats.todaysCollection.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2 group-hover:text-[#F2C14E] transition-colors font-medium">Click to view members & payments →</p>
        </div>
        
        <div 
          role="button"
          tabIndex={0}
          aria-label="View This Month's members and payments"
          onClick={() => setActiveDetailsModal("THIS_MONTH")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveDetailsModal("THIS_MONTH");
            }
          }}
          className="glass-panel p-6 border border-border relative overflow-hidden group hover:border-brand-gold/60 hover:bg-brand-gold/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-gold/10 cursor-pointer transition-all duration-300 focus-gold rounded-2xl"
        >
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-xs font-bold tracking-wider mb-1 uppercase">This Month</h3>
            <CalendarRange className="w-5 h-5 text-brand-gold/60 group-hover:text-brand-gold transition-colors" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-brand-gold">₹{stats.thisMonth.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2 group-hover:text-brand-gold transition-colors font-medium">Click to view members & payments →</p>
        </div>

        <div 
          role="button"
          tabIndex={0}
          aria-label="View pending payment members"
          onClick={() => setActiveDetailsModal("PENDING")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveDetailsModal("PENDING");
            }
          }}
          className="apple-glass p-6 relative overflow-hidden group hover:border-foreground/45 hover:-translate-y-1 hover:shadow-xl cursor-pointer transition-all duration-300 focus-gold rounded-2xl"
        >
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-xs font-bold tracking-wider mb-1 uppercase">Pending Amount</h3>
            <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-foreground">₹{(stats.totalPending || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2 group-hover:text-foreground transition-colors font-medium">Click to view pending members →</p>
        </div>

        <div 
          role="button"
          tabIndex={0}
          aria-label="View all record details"
          onClick={() => setActiveDetailsModal("TOTAL")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveDetailsModal("TOTAL");
            }
          }}
          className="glass-panel p-6 border border-border relative overflow-hidden group hover:border-brand-gold/60 hover:bg-brand-gold/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-gold/10 cursor-pointer transition-all duration-300 focus-gold rounded-2xl"
        >
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-muted-foreground text-xs font-bold tracking-wider mb-1 uppercase">Total Records</h3>
            <ListTree className="w-5 h-5 text-white/50 group-hover:text-brand-gold transition-colors" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2 group-hover:text-brand-gold transition-colors font-medium">Click to view all record details →</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Payments & Subscriptions</h1>
          <p className="text-muted-foreground text-sm md:text-base">Manage member active subscriptions, revenue intake, and billing.</p>
        </div>
        <button 
          onClick={() => {
            setModalError("");
            setModalMode("ASSIGN");
            setFormData({ memberId: "", planId: "", startDate: new Date().toISOString().split('T')[0], status: "ACTIVE", paymentStatus: "PAID", paymentMethod: "CASH", balanceAmount: "" });
            setIsModalOpen(true);
          }}
          className="touch-target gap-2 px-6 rounded-xl text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] font-bold transition-all gold-glow-sm focus-gold w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" aria-hidden="true" /> Assign Plan
        </button>
      </div>

      {/* View Switcher & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("SUBSCRIPTIONS")}
          className={`touch-target px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
            activeTab === "SUBSCRIPTIONS"
              ? "bg-[#DBA12C] text-[#0A0A0C] border-[#DBA12C]"
              : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          Subscriptions Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ONLINE")}
          className={`touch-target inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors ${
            activeTab === "ONLINE"
              ? "bg-[#DBA12C] text-[#0A0A0C] border-[#DBA12C]"
              : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          Razorpay & Online Transactions ({onlineTransactions.length})
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by member, plan, ID, or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:border-brand-gold/50 outline-none transition-colors"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-card/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-brand-gold/50 outline-none w-full sm:w-auto cursor-pointer"
          >
            <option>All Payments</option>
            <option>Paid</option>
            <option>Pending</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-brand-gold/50 outline-none w-full sm:w-auto cursor-pointer"
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Expired</option>
          </select>
          {(searchQuery || statusFilter !== "All Status" || paymentFilter !== "All Payments") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("All Status");
                setPaymentFilter("All Payments");
              }}
              className="text-xs text-brand-gold hover:underline px-2 py-1 font-medium transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {activeTab === "ONLINE" ? (
        <div className="glass-panel overflow-hidden border border-border">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Invoice No.</th>
                  <th className="px-6 py-4 font-medium">Member</th>
                  <th className="px-6 py-4 font-medium">Plan & Validity</th>
                  <th className="px-6 py-4 font-medium">Method / Ref</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingOnline && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Loader2 className="w-7 h-7 animate-spin text-[#DBA12C] mx-auto" />
                    </td>
                  </tr>
                )}
                {!loadingOnline && filteredOnlineTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No payment transactions match your current filter.
                    </td>
                  </tr>
                )}
                {filteredOnlineTransactions.map((pay) => {
                  const isSettled = pay.status === "CAPTURED" || pay.status === "COMPLETED";
                  return (
                    <tr key={pay.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4 font-mono-metric text-xs font-bold text-[#F2C14E]">
                        {pay.invoiceNumber || "PENDING"}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">
                          {pay.member?.user?.firstName} {pay.member?.user?.lastName}
                        </p>
                        <p className="font-mono-metric text-xs text-muted-foreground">
                          #{pay.member?.memberId || "N/A"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{pay.plan?.name || "Membership"}</p>
                        {pay.newExpiryDate && (
                          <p className="font-mono-metric text-xs text-muted-foreground mt-0.5">
                            Valid until {new Date(pay.newExpiryDate).toLocaleDateString("en-IN")}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-mono-metric text-xs font-bold uppercase text-foreground">
                          {pay.method}
                        </p>
                        <p className="font-mono-metric text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {pay.razorpayPaymentId || pay.razorpayOrderId || "Counter Settlement"}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-mono-metric font-bold text-foreground">
                        ₹{Number(pay.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full font-mono-metric text-xs font-bold border ${
                            isSettled
                              ? "bg-[#DBA12C]/15 text-[#F2C14E] border-[#DBA12C]/40"
                              : pay.status === "FAILED"
                                ? "bg-secondary text-muted-foreground border-border"
                                : "bg-secondary/50 text-foreground border-border"
                          }`}
                        >
                          {pay.status === "CAPTURED" ? "Captured" : pay.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSettled ? (
                          <button
                            type="button"
                            disabled={downloadingReceiptId === pay.id}
                            onClick={() => handleDownloadReceipt(pay.id, pay.invoiceNumber)}
                            className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[#DBA12C]/40 bg-[#DBA12C]/15 px-3 py-1.5 text-xs font-bold text-[#F2C14E] hover:bg-[#DBA12C]/25 transition-colors disabled:opacity-50"
                            title="Download PDF Receipt"
                          >
                            {downloadingReceiptId === pay.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            Download Receipt
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      /* Subscriptions Table */
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Plan Name</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Start Date</th>
                <th className="px-6 py-4 font-medium">Expiry Date</th>
                <th className="px-6 py-4 font-medium">Payment</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingSubs && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-gold mx-auto mb-4" />
                  </td>
                </tr>
              )}

              {subsError && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    Failed to load subscription records. Please refresh or sign in again.
                  </td>
                </tr>
              )}

              {!loadingSubs && !subsError && subscriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    No active subscriptions found.
                  </td>
                </tr>
              )}

              {!loadingSubs && subscriptions.length > 0 && filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <p className="text-base font-semibold mb-1 text-foreground">No matching subscriptions found</p>
                    <p className="text-xs mb-3 text-muted-foreground">Try adjusting your search query or filter criteria.</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("All Status");
                        setPaymentFilter("All Payments");
                      }}
                      className="px-4 py-1.5 rounded-lg border border-brand-gold text-brand-gold hover:bg-brand-gold/10 text-xs font-semibold transition-colors"
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>
              )}

              {filteredSubscriptions.map((sub: any, i: number) => {
                const isActive = sub.status === 'ACTIVE';
                
                return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={sub.id} 
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold text-xs border border-brand-gold/20">
                          {sub.member?.user?.firstName?.charAt(0)}{sub.member?.user?.lastName?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-foreground">{sub.member?.user?.firstName} {sub.member?.user?.lastName}</p>
                          <p className="text-brand-gold text-xs">{sub.member?.memberId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground">{sub.plan?.name}</td>
                    <td className="px-6 py-4 font-medium text-brand-gold">₹{sub.plan?.price}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {new Date(sub.startDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {new Date(sub.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sub.paymentStatus === 'PAID' ? 'bg-[#DBA12C]/15 text-[#F2C14E] border border-[#DBA12C]/30' : 'bg-foreground/10 text-foreground border border-foreground/25'}`}>
                          {sub.paymentStatus || 'PAID'}
                        </span>
                        {sub.paymentMethod && (
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider pl-1">
                            Via {sub.paymentMethod.replace('_', ' ')}
                          </span>
                        )}
                        {sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0 && (
                          <span className="text-[10px] text-foreground/80 font-bold uppercase tracking-wider pl-1 mt-1">
                            Bal: ₹{sub.balanceAmount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-[#DBA12C]/15 text-[#F2C14E] border border-[#DBA12C]/30' : 'bg-foreground/10 text-foreground/80 border border-foreground/25'}`}>
                        {isActive && <CheckCircle2 className="w-3 h-3" />}
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(sub)}
                          className="p-2 text-muted-foreground hover:text-brand-gold transition-colors rounded-lg hover:bg-brand-gold/10"
                          title="Edit Subscription"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                          title="Delete Subscription"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Assign Plan Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-[calc(100%-1.5rem)] sm:w-full max-w-lg apple-glass-elevated p-5 sm:p-8 rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-foreground/10 transition-colors focus-gold"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-[#F2C14E]">
                {modalMode === "ASSIGN" ? "Assign Subscription" : "Edit Subscription"}
              </h2>

              {modalError && (
                <div role="alert" className="mb-4 p-3 rounded-xl bg-foreground/[0.08] border border-foreground/25 text-foreground text-sm">
                  {modalError}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Select Member</label>
                  <select 
                    required 
                    disabled={modalMode === "EDIT"}
                    name="memberId" 
                    value={formData.memberId} 
                    onChange={e => setFormData(p => ({...p, memberId: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none disabled:opacity-50"
                  >
                    <option value="" disabled>-- Select a member --</option>
                    {members.map((m: any) => (
                      <option key={m.memberProfile.id} value={m.memberProfile.id}>
                        {m.memberProfile.memberId} - {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Select Plan</label>
                  <select 
                    required 
                    name="planId" 
                    value={formData.planId} 
                    onChange={e => handlePlanOrDateChange('planId', e.target.value)} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="" disabled>-- Select a plan --</option>
                    {plans.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price} for {p.durationDays} days)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <input 
                    required 
                    type="date" 
                    name="startDate" 
                    value={formData.startDate} 
                    onChange={e => handlePlanOrDateChange('startDate', e.target.value)} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">Expiry date will be calculated automatically based on the plan&apos;s duration.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Subscription Status</label>
                  <select 
                    required 
                    name="status" 
                    value={formData.status} 
                    onChange={e => setFormData(p => ({...p, status: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="FROZEN">FROZEN</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
                  <select 
                    required 
                    name="paymentStatus" 
                    value={formData.paymentStatus} 
                    onChange={e => setFormData(p => ({...p, paymentStatus: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                  <select 
                    required 
                    name="paymentMethod" 
                    value={formData.paymentMethod} 
                    onChange={e => setFormData(p => ({...p, paymentMethod: e.target.value}))} 
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none appearance-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                {formData.paymentStatus === 'PENDING' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Balance Amount (₹)</label>
                    <input 
                      required 
                      type="number"
                      min="0"
                      name="balanceAmount" 
                      value={formData.balanceAmount} 
                      onChange={e => setFormData(p => ({...p, balanceAmount: e.target.value}))} 
                      className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none"
                      placeholder="Enter pending balance amount"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-border flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-5 py-3 rounded-xl font-medium text-foreground hover:bg-white/5 transition-colors order-2 sm:order-1 border border-border sm:border-transparent">
                    Cancel
                  </button>
                  <button type="submit" disabled={mutation.isPending || updateMut.isPending} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] font-bold transition-all gold-glow-sm disabled:opacity-50 order-1 sm:order-2 focus-gold">
                    {(mutation.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : (modalMode === "ASSIGN" ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                    {modalMode === "ASSIGN" ? "Assign Plan" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentDetailsModal
        isOpen={activeDetailsModal !== null}
        onClose={() => setActiveDetailsModal(null)}
        type={activeDetailsModal}
        subscriptions={subscriptions}
      />
    </div>
  );
}
