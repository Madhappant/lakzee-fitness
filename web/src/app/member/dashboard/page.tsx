"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchMyProfile, fetchMyAttendance } from "@/lib/api/portal";
import { Loader2, CalendarCheck, Clock, ShieldCheck, Dumbbell, Receipt, ArrowRight, UserCircle } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

export default function MemberDashboard() {
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: fetchMyProfile,
  });

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["myAttendance"],
    queryFn: fetchMyAttendance,
  });

  if (profileLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const profile = profileData?.data;
  const recentAttendance = attendanceData?.data || [];
  const activeSubscription = profile?.subscriptions?.[0];
  
  // Calculate days remaining
  let daysRemaining = 0;
  if (activeSubscription) {
    const end = new Date(activeSubscription.endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome Back, {profile?.user?.firstName}!</h1>
          <p className="text-muted-foreground">Ready to crush your goals today?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: QR Code & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 border border-brand-gold/30 flex flex-col items-center justify-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 to-transparent pointer-events-none" />
            
            <h2 className="text-lg font-bold mb-4 text-center">Your Check-In Pass</h2>
            
            <div className="bg-white p-4 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] mb-4">
              <QRCodeSVG 
                value={profile?.qrCode || "invalid"} 
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
              />
            </div>
            
            <p className="text-sm text-brand-gold font-mono tracking-widest bg-brand-gold/10 px-4 py-1.5 rounded-full border border-brand-gold/30">
              ID: {profile?.memberId}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="glass-panel p-4 border border-border rounded-xl">
              <CalendarCheck className="w-6 h-6 text-brand-gold mb-2" />
              <p className="text-2xl font-bold">{recentAttendance.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Recent Visits</p>
            </div>
            <div className="glass-panel p-4 border border-border rounded-xl">
              <Dumbbell className="w-6 h-6 text-brand-gold mb-2" />
              <p className="text-2xl font-bold">{profile?.trainer ? "Yes" : "No"}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Personal Trainer</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Subscription & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel p-8 border border-brand-gold/20 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-32 h-32 text-brand-gold" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-end justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand-gold tracking-widest uppercase mb-2">Current Membership</h2>
                {activeSubscription ? (
                  <>
                    <h3 className="text-3xl font-bold mb-2">{activeSubscription.plan?.name}</h3>
                    <p className="text-muted-foreground mb-4 text-sm max-w-md">
                      Valid from {new Date(activeSubscription.startDate).toLocaleDateString()} to {new Date(activeSubscription.endDate).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="bg-card/50 border border-border rounded-lg px-4 py-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Days Remaining</p>
                        <p className={`text-2xl font-bold ${daysRemaining < 7 ? 'text-red-400' : 'text-green-400'}`}>
                          {daysRemaining}
                        </p>
                      </div>
                      <div className="bg-card/50 border border-border rounded-lg px-4 py-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                        <p className="text-2xl font-bold text-brand-gold">ACTIVE</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold mb-2 text-muted-foreground">No Active Plan</h3>
                    <p className="text-muted-foreground text-sm mb-4 max-w-md">
                      You currently do not have an active membership plan. Please visit the front desk to renew or explore our plans.
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6 border border-border flex flex-col h-80"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Recent Visits</h2>
                <Link href="/member/attendance" className="text-xs text-brand-gold hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {recentAttendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent visits recorded.</p>
                ) : (
                  recentAttendance.slice(0, 5).map((log: any) => {
                    const checkIn = new Date(log.checkIn);
                    return (
                      <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-brand-gold" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{checkIn.toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">{checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 border border-border flex flex-col h-80"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Trainer Info</h2>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                {profile?.trainer ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-brand-gold/20 border-2 border-brand-gold flex items-center justify-center mb-4">
                      <UserCircle className="w-12 h-12 text-brand-gold" />
                    </div>
                    <h3 className="text-xl font-bold">{profile.trainer.firstName} {profile.trainer.lastName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Personal Trainer</p>
                  </>
                ) : (
                  <>
                    <Dumbbell className="w-12 h-12 text-white/20 mb-4" />
                    <p className="text-sm text-muted-foreground max-w-[200px]">
                      You don't have a personal trainer assigned. Contact the front desk to upgrade your plan!
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
