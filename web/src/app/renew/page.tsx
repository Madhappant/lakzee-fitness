/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  ShieldCheck,
  Smartphone,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/api/config";
import { fetchPlans } from "@/lib/api/plans";
import { fetchMyProfile, fetchMySubscriptions } from "@/lib/api/portal";
import {
  createPublicRenewalOrder,
  createRazorpayOrder,
  downloadPaymentReceipt,
  downloadPublicRenewalReceipt,
  fetchPublicRenewalContext,
  verifyPublicRenewalPayment,
  verifyRazorpayPayment,
} from "@/lib/api/payments";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import type { PaymentTransactionRecord, PublicRenewalContext } from "@/lib/api/types";

function RenewCheckoutContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const preselectedPlanParam = searchParams.get("planId")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [context, setContext] = useState<PublicRenewalContext | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [renderNowMs] = useState<number>(() => Date.now());
  const [processingPayment, setProcessingPayment] = useState(false);
  const [capturedResult, setCapturedResult] = useState<{
    payment: PaymentTransactionRecord;
    invoiceNumber?: string;
    newExpiryDate?: string | null;
  } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      setNeedsLogin(false);

      try {
        if (token) {
          const res = await fetchPublicRenewalContext(token);
          if (!active) return;
          const ctx = res.data;
          setContext(ctx);
          setSelectedPlanId(preselectedPlanParam || ctx.selectedPlanId || ctx.plans[0]?.id || "");
        } else {
          const authToken = getAuthToken();
          if (!authToken) {
            if (!active) return;
            setNeedsLogin(true);
            setLoading(false);
            return;
          }

          const [profileRes, subsRes, plansRes] = await Promise.all([
            fetchMyProfile(),
            fetchMySubscriptions(),
            fetchPlans(),
          ]);
          if (!active) return;

          const profile = profileRes.data;
          const subs = Array.isArray(subsRes.data) ? subsRes.data : [];
          const plansList = Array.isArray(plansRes.data) ? plansRes.data : [];
          const latest = subs[0] || null;

          const normalizedCtx: PublicRenewalContext = {
            member: {
              id: profile.id,
              memberId: profile.memberId,
              name: `${profile.user?.firstName || ""} ${profile.user?.lastName || ""}`.trim() || "Member",
              branchId: profile.branchId || "branch-primary-001",
              branchName: profile.branch?.name || "Lakzee Fitness Studio",
            },
            currentSubscription: latest
              ? {
                  planId: latest.planId,
                  planName: latest.plan?.name || "Membership Plan",
                  endDate: latest.endDate,
                  isActive: latest.status === "ACTIVE" && new Date(latest.endDate).getTime() > Date.now(),
                }
              : null,
            selectedPlanId: preselectedPlanParam || latest?.planId || plansList[0]?.id || null,
            plans: plansList.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              price: Number(p.price),
              priceInPaise: p.priceInPaise ?? Math.round(Number(p.price) * 100),
              durationDays: Number(p.durationDays),
              gstPercentage: Number(p.taxPercent ?? p.gstPercentage ?? 18),
            })),
          };

          setContext(normalizedCtx);
          setSelectedPlanId(
            preselectedPlanParam || normalizedCtx.selectedPlanId || normalizedCtx.plans[0]?.id || ""
          );
        }
      } catch (err: any) {
        if (!active) return;
        setErrorMsg(err?.message || "Unable to load membership renewal details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [token, preselectedPlanParam]);

  const selectedPlan = useMemo(
    () => context?.plans.find((p) => p.id === selectedPlanId) || null,
    [context, selectedPlanId]
  );

  const previewNewExpiry = useMemo(() => {
    if (!selectedPlan) return null;
    const now = renderNowMs;
    const currentEnd = context?.currentSubscription?.endDate
      ? new Date(context.currentSubscription.endDate).getTime()
      : 0;
    const baseMs = context?.currentSubscription?.isActive && currentEnd > now ? currentEnd : now;
    return new Date(baseMs + selectedPlan.durationDays * 86_400_000);
  }, [context, selectedPlan, renderNowMs]);

  const handlePayNow = async () => {
    if (!context || !selectedPlan) {
      toast.error("Please select a membership plan to continue.");
      return;
    }

    setProcessingPayment(true);
    setErrorMsg("");

    try {
      const orderRes = token
        ? await createPublicRenewalOrder(token, selectedPlan.id)
        : await createRazorpayOrder({ memberId: context.member.id, planId: selectedPlan.id });

      const order = orderRes.data;

      await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amountInPaise: order.amountInPaise,
        currency: order.currency,
        name: "Lakzee Fitness Studio",
        description: `${order.plan.name} (${order.plan.durationDays} Days)`,
        prefill: {
          name: order.member.name,
          email: order.member.email,
          contact: order.member.phone,
        },
        notes: {
          memberCode: order.member.memberId,
          branchId: order.member.branchId,
        },
        onSuccess: async (rzpResponse) => {
          try {
            const verifyRes = token
              ? await verifyPublicRenewalPayment(token, {
                  razorpay_order_id: rzpResponse.razorpay_order_id,
                  razorpay_payment_id: rzpResponse.razorpay_payment_id,
                  razorpay_signature: rzpResponse.razorpay_signature,
                  method: "upi",
                })
              : await verifyRazorpayPayment({
                  razorpay_order_id: rzpResponse.razorpay_order_id,
                  razorpay_payment_id: rzpResponse.razorpay_payment_id,
                  razorpay_signature: rzpResponse.razorpay_signature,
                  method: "upi",
                });

            const confirmedPayment = verifyRes.data.payment;
            setCapturedResult({
              payment: confirmedPayment,
              invoiceNumber: confirmedPayment.invoiceNumber || verifyRes.data.invoice?.invoiceNumber,
              newExpiryDate: confirmedPayment.newExpiryDate || verifyRes.data.subscription?.endDate,
            });
            toast.success("Payment confirmed! Membership validity extended.");
          } catch (verifyErr: any) {
            const msg = verifyErr?.message || "Payment verification failed.";
            setErrorMsg(msg);
            toast.error(msg);
          } finally {
            setProcessingPayment(false);
          }
        },
        onFailure: (failureMsg) => {
          setErrorMsg(failureMsg);
          toast.error(failureMsg);
          setProcessingPayment(false);
        },
        onDismiss: () => {
          setProcessingPayment(false);
        },
      });
    } catch (err: any) {
      const msg = err?.message || "Could not create Razorpay payment order.";
      setErrorMsg(msg);
      toast.error(msg);
      setProcessingPayment(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!capturedResult?.payment?.id) return;
    setDownloadingPdf(true);
    try {
      const filename = `Receipt-${capturedResult.invoiceNumber || capturedResult.payment.id}.pdf`;
      if (token) {
        await downloadPublicRenewalReceipt(token, capturedResult.payment.id, filename);
      } else {
        await downloadPaymentReceipt(capturedResult.payment.id, filename);
      }
      toast.success("Receipt PDF downloaded.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download PDF receipt.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#0A0A0C] text-[#F5F5F7] flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-[#DBA12C]" aria-hidden="true" />
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="dark min-h-screen bg-[#0A0A0C] text-[#F5F5F7] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl apple-glass p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#DBA12C]/15 border border-[#DBA12C]/35 text-[#F2C14E] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[#F5F5F7]">Sign In to Renew</h1>
          <p className="text-sm text-[#F5F5F7]/70">
            Log in with your member credentials or open the signed renewal link sent to your WhatsApp or email.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login?redirect=/renew"
              className="flex-1 touch-target justify-center rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold text-sm px-5 py-3 transition-all focus-gold gold-glow-sm"
            >
              Sign In & Continue
            </Link>
            <Link
              href="/"
              className="touch-target justify-center rounded-xl border border-[#F5F5F7]/20 text-[#F5F5F7] text-sm px-5 py-3 hover:bg-[#F5F5F7]/5 transition-colors focus-gold"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="dark min-h-screen bg-[#0A0A0C] text-[#F5F5F7] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl apple-glass p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#F5F5F7]">Renewal Link Unavailable</h1>
          <p className="text-sm text-[#F5F5F7]/75">{errorMsg || "This renewal link has expired or is invalid."}</p>
          <Link
            href="/login"
            className="inline-flex touch-target items-center justify-center rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold text-sm px-6 py-3 focus-gold gold-glow-sm"
          >
            Sign In to Member Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative min-h-screen bg-[#0A0A0C] text-[#F5F5F7] py-10 px-4 sm:px-6 overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-24 right-1/4 h-96 w-96 rounded-full bg-[#DBA12C]/12 blur-[120px]"
      />
      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F5F5F7]/12 pb-5">
          <div>
            <p className="font-mono-metric text-[11px] uppercase tracking-[0.2em] text-[#F2C14E]">
              LAKZEE FITNESS STUDIO · {context.member.branchName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1 text-[#F5F5F7]">
              Online Membership Renewal
            </h1>
          </div>
          {!token && (
            <Link
              href="/member/subscriptions"
              className="touch-target inline-flex items-center gap-2 rounded-xl border border-[#F5F5F7]/15 px-4 py-2 text-sm text-[#F5F5F7]/85 hover:border-[#DBA12C]/50 hover:text-[#F2C14E] transition-colors focus-gold"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Subscriptions
            </Link>
          )}
        </div>

        {/* Captured Success Receipt Card */}
        {capturedResult ? (
          <div className="rounded-3xl apple-glass border-[#DBA12C]/45 p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#DBA12C] text-[#0A0A0C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#DBA12C]/15 border border-[#DBA12C]/40 text-[#F2C14E] font-mono-metric text-xs font-bold uppercase tracking-wider">
                  Payment Captured
                </span>
                <h2 className="text-2xl font-bold text-[#F5F5F7] mt-2">Membership Renewed Successfully</h2>
                <p className="text-sm text-[#F5F5F7]/75 mt-1">
                  Your GST tax receipt PDF has been generated and dispatched to your registered channels.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[#F5F5F7]/12 p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#F5F5F7]/60">Invoice No.</p>
                <p className="font-mono-metric text-sm font-bold text-[#F2C14E] mt-1">
                  {capturedResult.invoiceNumber || "CONFIRMED"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[#F5F5F7]/60">Amount Paid</p>
                <p className="font-mono-metric text-sm font-bold text-[#F5F5F7] mt-1">
                  ₹{Number(capturedResult.payment.amount || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[#F5F5F7]/60">New Valid Until</p>
                <p className="font-mono-metric text-sm font-bold text-[#F2C14E] mt-1">
                  {capturedResult.newExpiryDate
                    ? new Date(capturedResult.newExpiryDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Active"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                disabled={downloadingPdf}
                className="touch-target inline-flex items-center gap-2 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold text-sm px-6 py-3 transition-all disabled:opacity-60 focus-gold gold-glow-sm"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-4 h-4" aria-hidden="true" />
                )}
                Download Receipt (PDF)
              </button>
              <Link
                href="/member/subscriptions"
                className="touch-target inline-flex items-center justify-center rounded-xl border border-[#F5F5F7]/20 text-[#F5F5F7] text-sm font-semibold px-6 py-3 hover:bg-[#F5F5F7]/5 transition-colors focus-gold"
              >
                Open Member Portal
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Member Summary + Plan Selection */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl apple-glass p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#F5F5F7]/55">Renewing For Member</p>
                  <p className="text-xl font-bold text-[#F5F5F7] mt-1">
                    {context.member.name}{" "}
                    <span className="font-mono-metric text-sm text-[#F2C14E] ml-2">
                      #{context.member.memberId}
                    </span>
                  </p>
                </div>
                {context.currentSubscription ? (
                  <div className="text-left sm:text-right">
                    <p className="text-xs uppercase tracking-wider text-[#F5F5F7]/55">Current Plan</p>
                    <p className="text-sm font-semibold text-[#F5F5F7] mt-1">
                      {context.currentSubscription.planName} ·{" "}
                      <span
                        className={
                          context.currentSubscription.isActive ? "text-[#F2C14E]" : "text-[#F5F5F7]/70"
                        }
                      >
                        {context.currentSubscription.isActive ? "Expires" : "Expired"}{" "}
                        {new Date(context.currentSubscription.endDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-full border border-[#F5F5F7]/15 text-xs text-[#F5F5F7]/70">
                    New Membership Cycle
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-[#F5F5F7]">Select Renewal Plan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {context.plans.map((plan) => {
                    const isSelected = plan.id === selectedPlanId;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`text-left rounded-2xl p-5 apple-glass transition-all focus-gold ${
                          isSelected
                            ? "border-[#DBA12C] bg-[#DBA12C]/12 ring-1 ring-[#DBA12C]/40"
                            : "hover:border-[#F5F5F7]/35"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-base text-[#F5F5F7]">{plan.name}</h3>
                          <span className="font-mono-metric text-xs px-2.5 py-0.5 rounded-full border border-[#F5F5F7]/15 text-[#F5F5F7]/80">
                            {plan.durationDays}d
                          </span>
                        </div>
                        <p className="font-mono-metric text-2xl font-bold text-[#F2C14E] mt-3">
                          ₹{plan.price.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-[#F5F5F7]/65 mt-1">
                          Incl. {plan.gstPercentage}% GST · {plan.description || "Full studio & QR check-in access"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Payment Summary & Razorpay / UPI Checkout */}
            <div className="rounded-3xl apple-glass-elevated p-6 space-y-5 h-fit">
              <h2 className="text-lg font-bold text-[#F5F5F7]">Order Summary</h2>

              {selectedPlan ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-[#F5F5F7]/75">
                    <span>Plan</span>
                    <span className="font-semibold text-[#F5F5F7]">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-[#F5F5F7]/75">
                    <span>Duration</span>
                    <span className="font-mono-metric text-[#F5F5F7]">{selectedPlan.durationDays} Days</span>
                  </div>
                  {previewNewExpiry && (
                    <div className="flex justify-between text-[#F5F5F7]/75">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#DBA12C]" aria-hidden="true" />
                        Valid Until
                      </span>
                      <span className="font-mono-metric font-bold text-[#F2C14E]">
                        {previewNewExpiry.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[#F5F5F7]/12 pt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-[#F5F5F7]">Total Payable</span>
                    <span className="font-mono-metric text-2xl font-bold text-[#F2C14E]">
                      ₹{selectedPlan.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#F5F5F7]/65">Select a plan to view pricing.</p>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-[#F5F5F7]/25 bg-[#F5F5F7]/5 px-4 py-3 text-xs text-[#F5F5F7]">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                disabled={!selectedPlan || processingPayment}
                onClick={handlePayNow}
                className="w-full touch-target inline-flex items-center justify-center gap-2 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] font-bold text-sm px-5 py-3.5 transition-all disabled:opacity-50 focus-gold gold-glow-sm"
              >
                {processingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Smartphone className="w-4 h-4" aria-hidden="true" />
                )}
                {processingPayment ? "Processing Checkout..." : "Pay via UPI / Razorpay"}
              </button>

              <div className="pt-2 space-y-2 text-xs text-[#F5F5F7]/60">
                <p className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#DBA12C]" aria-hidden="true" />
                  Supports GPay, PhonePe, Paytm, BHIM UPI & Cards
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#DBA12C]" aria-hidden="true" />
                  Authoritative pricing verified on server · Instant PDF invoice
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RenewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0C] text-[#F5F5F7] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#DBA12C]" aria-hidden="true" />
        </div>
      }
    >
      <RenewCheckoutContent />
    </Suspense>
  );
}
