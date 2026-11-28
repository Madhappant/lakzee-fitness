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
  const dateLabel = isTypeActive ? "Active until" : "Joined";

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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-1.5rem)] sm:w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] p-5 sm:p-6 rounded-3xl apple-glass-elevated shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#DBA12C]/15 border border-[#DBA12C]/30">
                  <Icon className="w-5 h-5 text-[#DBA12C]" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    {title}
                  </h2>
                  <p className="font-mono-metric text-xs text-muted-foreground mt-0.5">
                    {members.length} {members.length === 1 ? "member" : "members"} total
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="touch-target text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors focus-gold"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Live Search */}
            <div className="relative mb-4 shrink-0">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by name, ID, plan or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 bg-background border border-border rounded-xl pl-10 pr-16 text-sm text-foreground focus:border-[#DBA12C] focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground font-mono-metric text-xs focus-gold rounded px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 -mx-6 px-6">
              {!filteredMembers || filteredMembers.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Icon className="w-10 h-10 mx-auto mb-3 opacity-25" aria-hidden="true" />
                  <p className="text-sm">{search ? "No matching members found" : emptyText}</p>
                </div>
              ) : (
                <div className="space-y-2.5 pb-2">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-secondary/40 hover:border-foreground/15 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{member.name}</p>
                          <span className="font-mono-metric text-[11px] px-2 py-0.5 rounded-md bg-background text-[#F2C14E] font-semibold border border-border">
                            {member.memberId}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Plan: <span className="font-mono-metric text-foreground/85">{member.planName}</span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        {member.date && (
                          <span className="font-mono-metric font-semibold text-[#F2C14E] bg-[#DBA12C]/15 border border-[#DBA12C]/30 px-3 py-1 rounded-full text-xs self-start sm:self-auto">
                            {dateLabel}: {new Date(member.date).toLocaleDateString()}
                          </span>
                        )}
                        <div className="flex items-center gap-4">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="inline-flex items-center gap-1 font-mono-metric text-xs text-muted-foreground hover:text-foreground transition-colors focus-gold rounded"
                            >
                              <Phone className="w-3 h-3" aria-hidden="true" /> {member.phone}
                            </a>
                          )}
                          {member.userId && (
                            <Link
                              href={`/admin/members?viewMember=${member.userId}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 text-xs text-[#F2C14E] hover:underline font-semibold focus-gold rounded"
                            >
                              Details <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
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
