"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTodayAttendance, checkInMember } from "@/lib/api/attendance";
import { LogIn, Loader2, Search, Camera, X } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then(mod => mod.Scanner), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full bg-muted/20 text-muted-foreground">Loading camera...</div>
});

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [lakzeeId, setLakzeeId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: fetchTodayAttendance,
    refetchInterval: 30000, // Auto refresh every 30s
  });

  const logs = data?.data || [];

  const mutation = useMutation({
    mutationFn: checkInMember,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setLakzeeId("");
      setStatusMessage({ type: 'success', text: res.message });
      setTimeout(() => setStatusMessage(null), 3000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  });

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lakzeeId) return;
    mutation.mutate(lakzeeId.toUpperCase());
  };

  const handleScan = (result: any) => {
    if (result && result.length > 0) {
      const scannedId = result[0].rawValue || result[0].text || result[0];
      if (scannedId) {
        setLakzeeId(scannedId);
        setIsScanning(false);
        mutation.mutate(scannedId.toUpperCase());
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Daily Attendance</h1>
        <p className="text-muted-foreground">Log member check-ins and view today's active members.</p>
      </div>

      {/* Quick Check-in Module */}
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <LogIn className="w-48 h-48 text-brand-gold" />
        </div>
        
        <div className="flex items-center justify-between relative z-10 mb-6">
          <h2 className="text-xl font-bold text-brand-gold">Quick Check-in Scanner</h2>
          <button 
            onClick={() => setIsScanning(!isScanning)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-sm font-medium"
          >
            {isScanning ? <><X className="w-4 h-4" /> Close Camera</> : <><Camera className="w-4 h-4" /> Scan QR</>}
          </button>
        </div>

        {isScanning && (
          <div className="relative z-10 w-full max-w-sm mx-auto mb-6 overflow-hidden rounded-xl border border-brand-gold/30 aspect-square bg-background">
            <Scanner 
              onScan={handleScan}
              formats={["qr_code"]}
            />
          </div>
        )}
        
        <form onSubmit={handleCheckIn} className="flex flex-col sm:flex-row gap-4 relative z-10">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold/50" />
            <input 
              required
              autoFocus
              type="text" 
              placeholder="Scan QR or enter Lakzee ID (e.g. LZ-1234)" 
              value={lakzeeId}
              onChange={(e) => setLakzeeId(e.target.value)}
              className="w-full bg-card/50 border border-brand-gold/30 rounded-xl pl-12 pr-4 py-4 text-lg font-mono text-brand-gold focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all uppercase"
            />
          </div>
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold font-bold transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Check In
          </button>
        </form>

        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl font-medium text-center ${statusMessage.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}
          >
            {statusMessage.text}
          </motion.div>
        )}
      </div>

      {/* Today's Log Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Today's Check-ins ({logs.length})</h2>
          <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString()}</span>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Lakzee ID</th>
                <th className="px-6 py-4 font-medium">Member Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b border-border/50">
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted/60 animate-pulse rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-muted/60 animate-pulse rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-muted/60 animate-pulse rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-20 bg-muted/60 animate-pulse rounded-full"></div></td>
                    </tr>
                  ))}
                </>
              )}

              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No check-ins yet today.
                  </td>
                </tr>
              )}

              {logs.map((log: any, i: number) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  key={log.id} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-foreground">
                    {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 font-medium text-brand-gold">
                    {log.member?.memberId}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{log.member?.user?.firstName} {log.member?.user?.lastName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                      Present
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
