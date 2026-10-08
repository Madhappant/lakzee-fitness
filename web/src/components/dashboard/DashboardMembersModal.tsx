"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Users, UserPlus, Search, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export interface DashboardMemberItem {
  id: string;
  userId?: string;
  name: string;
  memberId: string;
  planName: string;
  date?: string;
  phone?: string;
  email?: string;
}

export function DashboardMembersModal({
  isOpen,
  onClose,
  members = [],
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: DashboardMemberItem[];
  type: "ACTIVE" | "NEW";
}) {
  const [search, setSearch] = useState("");

  const isTypeActive = type === "ACTIVE";
  const Icon = isTypeActive ? Users : UserPlus;
  const title = isTypeActive ? "Total Active Members" : "New Members This Month";
  const emptyText = isTypeActive ? "No active members found." : "No new signups this month.";
  const colorClass = isTypeActive ? "text-brand-gold" : "text-emerald-400";
  const bgClass = isTypeActive ? "bg-brand-gold/10" : "bg-emerald-500/10";
  const dateLabel = isTypeActive ? "Active Until" : "Joined On";

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.memberId?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
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
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] p-6 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${bgClass}`}>
                  <Icon className={`w-5 h-5 ${colorClass}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {members.length} {members.length === 1 ? "member" : "members"} total
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative mb-4 shrink-0">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, ID, plan or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:border-brand-gold outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 -mx-6 px-6">
              {!filteredMembers || filteredMembers.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Icon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{search ? "No matching members found" : emptyText}</p>
                </div>
              ) : (
                <div className="space-y-3 pb-2">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{member.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-brand-gold font-medium border border-border">
                            {member.memberId}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Plan: <span className="text-foreground/80 font-medium">{member.planName}</span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        {member.date && (
                          <span className={`font-semibold ${colorClass} ${bgClass} px-3 py-1 rounded-full text-xs self-start sm:self-auto`}>
                            {dateLabel}: {new Date(member.date).toLocaleDateString()}
                          </span>
                        )}
                        <div className="flex items-center gap-3">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-gold transition-colors"
                            >
                              <Phone className="w-3 h-3" /> {member.phone}
                            </a>
                          )}
                          {member.userId && (
                            <Link
                              href={`/admin/members?viewMember=${member.userId}`}
                              onClick={onClose}
                              className="flex items-center gap-1 text-xs text-brand-gold hover:underline font-medium"
                            >
                              Details <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
