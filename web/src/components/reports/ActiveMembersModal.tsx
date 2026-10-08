/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Users, Phone, Mail, Calendar, CheckCircle2, ShieldCheck } from "lucide-react";

export interface ActiveMemberItem {
  id: string;
  userId?: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  planName: string;
  planPrice?: number;
  startDate?: string;
  endDate?: string;
  status: string;
}

interface ActiveMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: ActiveMemberItem[];
}

export function ActiveMembersModal({
  isOpen,
  onClose,
  members = [],
}: ActiveMembersModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.memberId?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.planName?.toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] p-6 md:p-8 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                  <Users className="w-6 h-6 text-brand-gold" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    Active Members Details
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    Currently active gym memberships and member information
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics & Filter Bar */}
            <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Active:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold font-bold text-sm border border-brand-gold/20">
                  {members.length}
                </span>
              </div>
              {filtered.length !== members.length && (
                <span className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {members.length}
                </span>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, member ID, phone, email, or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-brand-gold focus:outline-none text-sm transition-colors text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 min-h-0">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No active members found.</p>
                  {search && <p className="text-xs mt-1">Try adjusting your search criteria.</p>}
                </div>
              ) : (
                filtered.map((item) => {
                  const endStr = item.endDate
                    ? new Date(item.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Ongoing";

                  const startStr = item.startDate
                    ? new Date(item.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border hover:border-brand-gold/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-base">
                            {item.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-brand-gold/10 text-brand-gold font-mono font-semibold border border-brand-gold/20">
                            {item.memberId || "MEMBER"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 border border-green-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              className="flex items-center gap-1 text-muted-foreground hover:text-brand-gold transition-colors"
                            >
                              <Phone className="w-3 h-3 text-brand-gold" />
                              {item.phone}
                            </a>
                          )}
                          {item.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              {item.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Plan & Dates */}
                      <div className="flex flex-col md:items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-gold" />
                          <span className="font-semibold text-foreground text-sm">
                            {item.planName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>
                            {startStr ? `${startStr} → ` : ""}
                            <span className="text-brand-gold font-medium">Valid until {endStr}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
