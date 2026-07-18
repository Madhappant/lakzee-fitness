"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyAttendance } from "@/lib/api/portal";
import { Loader2, CalendarCheck, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";

export default function MemberAttendance() {
  const { data, isLoading } = useQuery({
    queryKey: ["myAttendance"],
    queryFn: fetchMyAttendance,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const attendanceLogs = data?.data || [];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Attendance</h1>
        <p className="text-muted-foreground">Track your gym visits and consistency.</p>
      </div>

      <div className="glass-panel p-6 border border-border">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-brand-gold" />
            Check-in History
          </h2>
          <span className="bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full text-sm font-bold border border-brand-gold/30">
            {attendanceLogs.length} Visits
          </span>
        </div>

        {attendanceLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>You haven't checked in yet. See you at the gym soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attendanceLogs.map((log: any, i: number) => {
              const checkIn = new Date(log.checkIn);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-border hover:border-brand-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20">
                      <Clock className="w-6 h-6 text-brand-gold" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{checkIn.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Lakzee Studio
                        </span>
                        <span>{checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs text-brand-gold uppercase tracking-wider font-bold mb-1">Status</span>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                      Verified
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
