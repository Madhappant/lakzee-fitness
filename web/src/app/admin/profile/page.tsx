"use client";

import { useEffect, useState } from "react";
import { UserCircle, Mail, ShieldCheck, Copy, CheckCircle2, Phone, X, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PhoneStep = "IDLE" | "REQUEST_OTP" | "VERIFY_OTP" | "SUCCESS";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Phone Update State
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("IDLE");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulatedData, setSimulatedData] = useState<{otp: string, phone: string, previewUrl?: string} | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("lakzee_user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {}
    }
  }, []);

  const copyToClipboard = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")}/auth/request-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, newPhone }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to request OTP.");
      
      if (data.simulatedOtp) {
        setSimulatedData({ otp: data.simulatedOtp, phone: data.phoneMasked, previewUrl: data.previewUrl });
      }
      setPhoneStep("VERIFY_OTP");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")}/auth/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, otp }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to verify OTP.");
      
      // Update local storage and state
      const updatedUser = data.data.user;
      const fullLocalUser = { ...user, phone: updatedUser.phone };
      localStorage.setItem("lakzee_user", JSON.stringify(fullLocalUser));
      setUser(fullLocalUser);
      
      setPhoneStep("SUCCESS");
      setTimeout(() => {
        setPhoneStep("IDLE");
        setNewPhone("");
        setOtp("");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Invalid OTP or request expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPhoneFlow = () => {
    setPhoneStep("IDLE");
    setNewPhone("");
    setOtp("");
    setError("");
    setSimulatedData(null);
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal account settings and view your unique ID.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Role */}
        <div className="col-span-1 space-y-6">
          <div className="glass-panel p-8 flex flex-col items-center text-center border-t-4 border-brand-gold relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <UserCircle className="w-48 h-48 text-brand-gold" />
            </div>
            
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border-2 border-brand-gold/50 flex items-center justify-center mb-6 relative z-10 shadow-lg shadow-brand-gold/10">
              <UserCircle className="w-16 h-16 text-brand-gold" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground relative z-10">{user.firstName} {user.lastName}</h2>
            <div className="flex items-center gap-2 mt-2 text-brand-gold bg-brand-gold/10 px-4 py-1.5 rounded-full border border-brand-gold/20 relative z-10">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold tracking-wider uppercase">{user.role}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="glass-panel p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-brand-gold" />
              Account Details
            </h3>
            
            <div className="space-y-6">
              <div className="bg-muted/50 border border-border rounded-xl p-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">Full Name</p>
                <p className="text-lg font-medium text-foreground">{user.firstName} {user.lastName}</p>
              </div>
              
              <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Email Address</p>
                  <p className="text-foreground font-medium">{user.email}</p>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-brand-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Phone Number</p>
                    {user.phone ? (
                      <p className="text-foreground font-medium">{user.phone}</p>
                    ) : (
                      <p className="text-muted-foreground italic text-sm">Not provided</p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setPhoneStep("REQUEST_OTP")}
                  className="px-4 py-2 bg-background hover:bg-muted border border-border text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  {user.phone ? "Update" : "Add Phone"}
                </button>
              </div>

            </div>
          </div>

          <div className="glass-panel p-8 border-l-4 border-brand-gold/50">
            <h3 className="text-xl font-bold mb-4">Your Unique User ID</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              This UUID uniquely identifies your account across the Lakzee Fitness platform. 
              If you are a staff member, your administrator will need this exact ID to assign you the correct role permissions.
            </p>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-4 text-foreground font-mono text-sm sm:text-base break-all">
                {user.id}
              </div>
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-6 py-4 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shrink-0 shadow-lg shadow-brand-gold/20"
              >
                {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Update Modal Overlay */}
      <AnimatePresence>
        {phoneStep !== "IDLE" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              {/* Dynamic Background for Modal */}
              <div className="absolute inset-0 bg-gradient-to-b from-brand-gold/5 to-transparent pointer-events-none" />
              
              <button 
                onClick={resetPhoneFlow}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-10">
                {phoneStep === "REQUEST_OTP" && (
                  <form onSubmit={handleRequestOtp} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Update Phone Number</h3>
                      <p className="text-sm text-muted-foreground mb-6">Enter your new phone number. We will send an OTP to verify it.</p>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                        {error}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        New Phone Number
                      </label>
                      <input
                        type="text"
                        required
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-gold/50 transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || newPhone.length < 5}
                      className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Send OTP
                    </button>
                  </form>
                )}

                {phoneStep === "VERIFY_OTP" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Verify Phone Number</h3>
                      <p className="text-sm text-muted-foreground mb-6">Enter the 6-digit code sent to your phone.</p>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                        {error}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        6-Digit OTP
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-gold/50 transition-all font-mono tracking-widest text-center text-xl"
                        placeholder="------"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otp.length !== 6}
                      className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Verify & Save
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setPhoneStep("REQUEST_OTP")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground mt-2"
                    >
                      Use a different number
                    </button>
                  </form>
                )}

                {phoneStep === "SUCCESS" && (
                  <div className="text-center space-y-6 py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Phone Verified!</h3>
                    <p className="text-muted-foreground text-sm">
                      Your phone number has been successfully updated and verified.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
