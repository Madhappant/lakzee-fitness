"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

interface ErrorFallbackCardProps {
  title?: string;
  subtitle?: string;
  digest?: string;
  onReset: () => void;
  fallbackHref?: string;
  fallbackLabel?: string;
}

export function ErrorFallbackCard({
  title = "Something interrupted this view",
  subtitle = "An unexpected runtime issue was logged safely for diagnostics. Your data remains intact.",
  digest,
  onReset,
  fallbackHref = "/admin/dashboard",
  fallbackLabel = "Return to Dashboard",
}: ErrorFallbackCardProps) {
  return (
    <div
      role="alert"
      className="min-h-[70vh] w-full bg-[#0A0A0C] text-[#F5F5F7] flex items-center justify-center p-6"
    >
      <div className="max-w-lg w-full rounded-2xl border border-[#F5F5F7]/12 bg-[#0A0A0C] p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#D4FF00]/12 border border-[#D4FF00]/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#D4FF00]" aria-hidden="true" />
          </div>
          <span className="font-mono-metric text-[11px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-[#F5F5F7]/[0.06] border border-[#F5F5F7]/15 text-[#F5F5F7]/80">
            Session Recovery
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F5F7]">
            {title}
          </h1>
          <p className="text-sm text-[#F5F5F7]/70 leading-relaxed">{subtitle}</p>
          {digest && (
            <p className="font-mono-metric text-xs text-[#D4FF00]/90 pt-1">
              Incident Ref: {digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onReset}
            className="touch-target inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-[#D4FF00] text-[#0A0A0C] font-bold text-sm hover:brightness-105 transition-all cursor-pointer focus-volt"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>

          <Link
            href={fallbackHref}
            className="touch-target inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl border border-[#F5F5F7]/15 bg-[#F5F5F7]/[0.04] text-[#F5F5F7] text-sm font-semibold hover:border-[#D4FF00]/50 transition-colors focus-volt"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4FF00]" aria-hidden="true" />
            {fallbackLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
