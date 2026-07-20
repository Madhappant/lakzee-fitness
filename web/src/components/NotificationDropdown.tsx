"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  type: "EXPIRY" | "PAYMENT" | "SYSTEM" | "ANNOUNCEMENT";
  title: string;
  message: string;
  date: string;
  link: string;
  read: boolean;
};

export function NotificationDropdown({ role }: { role: "ADMIN" | "MEMBER" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
    queryFn: async () => {
      const token = localStorage.getItem("lakzee_token");
      if (!token) return [];
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api")}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      return json.data as Notification[];
    },
    refetchInterval: 60000 // Refetch every minute
  });

  const unreadCount = notifications.length; // We are dynamically generating them, all are "active" alerts

  const getIcon = (type: string) => {
    switch (type) {
      case "EXPIRY": return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "PAYMENT": return <CreditCard className="w-5 h-5 text-red-500" />;
      case "ANNOUNCEMENT": return <Bell className="w-5 h-5 text-blue-500" />; // using Bell or Megaphone (if imported)
      default: return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-card"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-bold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                  {unreadCount} Active
                </span>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading alerts...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-green-500/50 mb-2" />
                  <p>You're all caught up!</p>
                  <p className="text-xs">No pending payments or expiring members.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="shrink-0 p-2 bg-background rounded-full border border-border shadow-sm">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {notif.title}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium pt-1">
                          {formatDistanceToNow(new Date(notif.date), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-border bg-muted/30 text-center text-xs text-muted-foreground">
              Alerts update automatically
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
