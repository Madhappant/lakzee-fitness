"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dumbbell, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to request OTP.");
      
      if (data.simulatedOtp) {
        setSimulatedData({ otp: data.simulatedOtp, phone: data.phoneMasked, previewUrl: data.previewUrl });
      }
      setStep("VERIFY_OTP");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");
      
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "Invalid OTP or request expired.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-gold/10 via-black to-black -z-10" />
      <div className="absolute -left-40 top-40 w-96 h-96 bg-brand-gold/5 rounded-full blur-[100px] -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-3 group mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-gold to-yellow-600 flex items-center justify-center text-primary-foreground">
            <Dumbbell className="w-7 h-7 transform -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
          </div>
          <span className="text-3xl font-bold tracking-wider uppercase text-gradient">
            LAKZEE
          </span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          {step === "SUCCESS" ? "Password Reset Complete" : "Reset your password"}
        </h2>
        {step !== "SUCCESS" && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="font-medium text-brand-gold hover:text-brand-gold/80 transition-colors">
              Sign in
            </Link>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-4 sm:rounded-2xl sm:px-10 border border-border shadow-2xl relative">
          
          <AnimatePresence mode="wait">
            {step === "REQUEST_OTP" && (
              <motion.form 
                key="request"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6" 
                onSubmit={handleRequestOtp}
              >
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">We will send a 6-digit OTP to your registered email.</p>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold/50 transition-all duration-300"
                    placeholder="Enter your registered email"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-gold focus:ring-offset-black transition-all duration-300 shadow-lg shadow-brand-gold/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Send OTP via Email
                  </button>
                </div>
              </motion.form>
            )}

            {step === "VERIFY_OTP" && (
              <motion.form 
                key="verify"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6" 
                onSubmit={handleResetPassword}
              >
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
                
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-foreground">
                    6-Digit OTP
                  </label>
                  <div className="mt-2">
                    <input
                      id="otp"
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="appearance-none block w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold/50 transition-all duration-300 font-mono tracking-widest text-center text-xl"
                      placeholder="------"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                    New Password
                  </label>
                  <div className="mt-2">
                    <input
                      id="newPassword"
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold/50 transition-all duration-300"
                      placeholder="Enter new secure password"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-gold focus:ring-offset-black transition-all duration-300 shadow-lg shadow-brand-gold/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Verify & Reset Password
                  </button>
                </div>
              </motion.form>
            )}

            {step === "SUCCESS" && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-medium text-foreground">Password Updated!</h3>
                <p className="text-muted-foreground text-sm">
                  Your password has been securely reset. You can now log in to your account.
                </p>
                <Link 
                  href="/login"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-gold focus:ring-offset-black transition-all duration-300 shadow-lg shadow-brand-gold/20"
                >
                  Return to Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== "SUCCESS" && (
            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
              <button 
                onClick={() => setStep("REQUEST_OTP")} 
                className={`text-sm text-brand-gold hover:text-brand-gold/80 transition-colors ${step === "REQUEST_OTP" ? "invisible" : ""}`}
              >
                Start Over
              </button>
              <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
