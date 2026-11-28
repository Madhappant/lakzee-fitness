"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { notificationService } from "@/lib/api/notifications";

export function NotificationDropdown({ role }: { role?: "ADMIN" | "MEMBER" } = {}) {
  void role;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationService.list,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const unreadCount = notifications.length;

  const getIcon = (type: string) => {
    switch (type) {
      case "EXPIRY":
        return <AlertTriangle className="w-4 h-4 text-[#DBA12C]" aria-hidden="true" />;
      case "PAYMENT":
        return <CreditCard className="w-4 h-4 text-[#F5F5F7]" aria-hidden="true" />;
      default:
        return <Bell className="w-4 h-4 text-[#DBA12C]" aria-hidden="true" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary focus-gold relative"
        aria-label={`View notifications (${unreadCount} active)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="font-mono-metric absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-[#DBA12C] text-[#0A0A0C] text-[10px] font-bold flex items-center justify-center rounded-full border border-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Notifications Panel"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-[min(calc(100vw-1.5rem),22rem)] sm:w-96 apple-glass-elevated rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/40">
              <h3 className="font-display font-bold text-foreground text-base">Notifications</h3>
              {unreadCount > 0 && (
                <span className="font-mono-metric text-[11px] bg-[#DBA12C]/15 text-[#F2C14E] border border-[#DBA12C]/30 px-2.5 py-0.5 rounded-full font-bold">
                  {unreadCount} Active
                </span>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-[#DBA12C] border-t-transparent rounded-full animate-spin" />
                  <span className="font-mono-metric text-xs">Loading alerts...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-9 h-9 text-[#DBA12C]/60 mb-1" aria-hidden="true" />
                  <p className="text-sm text-foreground font-medium">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground">
                    No pending payments or expiring members.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3.5 p-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="shrink-0 p-2 bg-secondary rounded-xl border border-border">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                          {notif.message}
                        </p>
                        <p className="font-mono-metric text-[11px] text-muted-foreground/80 pt-0.5">
                          {formatDistanceToNow(new Date(notif.date), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-secondary/30 text-center font-mono-metric text-[11px] text-muted-foreground">
              Alerts update automatically
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
