/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMySubscriptions } from "@/lib/api/portal";
import { downloadPaymentReceipt, fetchOnlinePayments } from "@/lib/api/payments";
import { Loader2, Receipt, CreditCard, Calendar, Download, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function MemberSubscriptions() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mySubscriptions"],
    queryFn: fetchMySubscriptions,
  });

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ["myOnlinePayments"],
    queryFn: () => fetchOnlinePayments({ limit: 50 }),
  });

  const handleDownload = async (paymentId: string, invoiceNumber?: string | null) => {
    setDownloadingId(paymentId);
    try {
      await downloadPaymentReceipt(paymentId, `Receipt-${invoiceNumber || paymentId.slice(0, 8)}.pdf`);
      toast.success("Receipt PDF downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download receipt PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DBA12C]" />
      </div>
    );
  }

  const subscriptions = data?.data || [];
  const receipts = (paymentsData?.data || []).filter(
    (p) => p.status === "CAPTURED" || p.status === "COMPLETED"
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Subscriptions</h1>
          <p className="text-muted-foreground">View your active plans, online UPI renewals, and PDF GST receipts.</p>
        </div>
        <Link
          href="/renew"
          className="touch-target inline-flex items-center justify-center gap-2 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold text-sm px-5 py-3 transition-all focus-gold gold-glow-sm"
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          Renew / Pay via UPI
        </Link>
      </div>

      {/* Membership Plan History */}
      <div className="glass-panel p-6 border border-border">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#DBA12C]" />
            Subscription History
          </h2>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No subscription records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-4 pr-4">Plan Details</th>
                  <th className="pb-4 px-4">Validity Period</th>
                  <th className="pb-4 px-4">Amount</th>
                  <th className="pb-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {subscriptions.map((sub: any, i: number) => {
                  const isActive = sub.status === "ACTIVE";
                  return (
                    <motion.tr
                      key={sub.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <p className="font-bold text-foreground">{sub.plan?.name}</p>
                        <p className="text-xs text-[#F2C14E] mt-1">
                          Purchased on {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                        {sub.invoice?.invoiceNumber && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {sub.invoice.invoiceNumber}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground/50" />
                          <span>
                            {new Date(sub.startDate).toLocaleDateString()} -{" "}
                            {new Date(sub.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold font-mono-metric text-lg">₹{sub.plan?.price}</p>
                        {sub.paymentStatus === "PENDING" || (sub.balanceAmount && sub.balanceAmount > 0) ? (
                          <span className="text-xs text-muted-foreground font-medium">
                            {sub.balanceAmount > 0
                              ? `Pending ₹${Number(sub.balanceAmount).toLocaleString()}`
                              : "Payment Pending"}
                          </span>
                        ) : (
                          <span className="text-xs text-[#F2C14E] font-semibold">Paid</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            isActive
                              ? "bg-[#DBA12C]/15 text-[#F2C14E] border-[#DBA12C]/30"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Downloadable Payment Receipts */}
      <div className="glass-panel p-6 border border-border">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Download className="w-5 h-5 text-[#DBA12C]" />
            Tax Receipts (PDF)
          </h2>
        </div>

        {loadingPayments ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#DBA12C]" />
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Verified payment receipts will appear here after online or counter settlements.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Invoice No.</th>
                  <th className="pb-3 px-4">Plan & Date</th>
                  <th className="pb-3 px-4">Method</th>
                  <th className="pb-3 px-4">Amount</th>
                  <th className="pb-3 pl-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receipts.map((pay) => (
                  <tr key={pay.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-4 pr-4 font-mono-metric text-xs font-bold text-[#F2C14E]">
                      {pay.invoiceNumber || pay.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-foreground">{pay.plan?.name || "Membership Plan"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pay.paidAt || pay.paymentDate).toLocaleDateString("en-IN")}
                      </p>
                    </td>
                    <td className="py-4 px-4 uppercase font-mono-metric text-xs text-muted-foreground">
                      {pay.method}
                    </td>
                    <td className="py-4 px-4 font-mono-metric font-bold text-foreground">
                      ₹{Number(pay.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 pl-4 text-right">
                      <button
                        type="button"
                        disabled={downloadingId === pay.id}
                        onClick={() => handleDownload(pay.id, pay.invoiceNumber)}
                        className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-[#DBA12C]/40 bg-[#DBA12C]/15 px-3.5 py-2 text-xs font-bold text-[#F2C14E] hover:bg-[#DBA12C]/25 transition-colors disabled:opacity-50 focus-gold"
                      >
                        {downloadingId === pay.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        Download Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
