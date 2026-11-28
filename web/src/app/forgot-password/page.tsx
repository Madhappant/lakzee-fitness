"use client";
import { authService } from "@/lib/api/auth";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "REQUEST_OTP" | "VERIFY_OTP" | "SUCCESS";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("REQUEST_OTP");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulatedData, setSimulatedData] = useState<{otp: string, phone: string, previewUrl?: string} | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const data = await authService.requestPasswordOtp(email);

      if (data.simulatedOtp) {
        setSimulatedData({
          otp: data.simulatedOtp,
          phone: data.data?.phoneMasked || data.phoneMasked || "",
          previewUrl: data.previewUrl,
        });
      }
      setStep("VERIFY_OTP");
    } catch (err: Error | unknown) {
      setError((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await authService.resetPassword({ email, otp, newPassword });
      setStep("SUCCESS");
    } catch (err: Error | unknown) {
      setError((err as Error).message || "Invalid OTP or request expired.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0A0A0C] text-[#F5F5F7] p-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-[#DBA12C]/15 blur-[110px]"
      />
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="rounded-3xl apple-glass p-6 sm:p-8 flex flex-col gap-6 w-full shadow-2xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <Link href="/" className="focus-gold rounded-full">
              <Image
                src="/logo.jpg"
                alt="Lakzee Fitness Studio"
                width={72}
                height={72}
                className="w-16 h-16 object-cover rounded-full border border-brand-gold/50 bg-white"
                priority
              />
            </Link>
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-wide text-foreground">
                {step === "SUCCESS" ? "Password updated" : "Reset your password"}
              </h1>
              {step !== "SUCCESS" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Remembered your password?{" "}
                  <Link href="/login" className="font-semibold text-brand-gold hover:underline focus-gold rounded">
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "REQUEST_OTP" && (
              <motion.form
                key="request"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
                onSubmit={handleRequestOtp}
              >
                {error && (
                  <div role="alert" className="p-3 bg-[#F5F5F7]/[0.08] border border-[#F5F5F7]/25 rounded-xl text-[#F5F5F7] text-sm text-center">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <p className="text-xs text-muted-foreground">
                    We will send a 6-digit verification code to your registered email.
                  </p>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg h-12 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus-gold transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 flex justify-center items-center gap-2 px-4 rounded-xl text-sm font-bold text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] transition-all focus-gold touch-target gold-glow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                  Send verification code
                </button>
              </motion.form>
            )}

            {step === "VERIFY_OTP" && (
              <motion.form
                key="verify"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
                onSubmit={handleResetPassword}
              >
                {error && (
                  <div role="alert" className="p-3 bg-[#F5F5F7]/[0.08] border border-[#F5F5F7]/25 rounded-xl text-[#F5F5F7] text-sm text-center">
                    {error}
                  </div>
                )}

                {simulatedData?.otp && (
                  <p className="text-xs text-brand-gold bg-brand-gold/10 border border-brand-gold/25 p-2.5 rounded-lg text-center tabular-nums">
                    Demo OTP: {simulatedData.otp}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="otp" className="block text-sm font-medium text-foreground">
                    6-digit code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-background border border-border rounded-lg h-12 px-4 text-center font-mono text-xl tracking-widest text-foreground placeholder:text-muted-foreground/60 focus-gold transition-all"
                    placeholder="------"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg h-12 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus-gold transition-all"
                    placeholder="Enter at least 6 characters"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 flex justify-center items-center gap-2 px-4 rounded-xl text-sm font-bold text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] transition-all focus-gold touch-target gold-glow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                  Verify and reset password
                </button>
              </motion.form>
            )}

            {step === "SUCCESS" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-5"
              >
                <div className="w-14 h-14 bg-[#DBA12C]/15 border border-[#DBA12C]/35 rounded-full flex items-center justify-center mx-auto text-[#F2C14E]">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your password has been updated. Sign in with your new credentials.
                </p>
                <Link
                  href="/login"
                  className="w-full h-12 flex justify-center items-center px-4 rounded-xl text-sm font-bold text-[#0A0A0C] bg-[#DBA12C] hover:bg-[#F2C14E] transition-all focus-gold touch-target gold-glow-sm"
                >
                  Return to sign in
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== "SUCCESS" && (
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("REQUEST_OTP")}
                className={`text-sm font-medium text-brand-gold hover:underline focus-gold rounded ${step === "REQUEST_OTP" ? "invisible" : ""}`}
              >
                Start over
              </button>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-gold rounded">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
