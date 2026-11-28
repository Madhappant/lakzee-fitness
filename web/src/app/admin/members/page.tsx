/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useDeferredValue, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMembers, updateMember, deleteMember, API_URL } from "@/lib/api/members";
import { sendManualReminder } from "@/lib/api/notifications";
import { createMemberRenewalLink } from "@/lib/api/payments";
import { sortMembers, type MemberSortOrder } from "@/lib/members-sort";
import { useBranchScope } from "@/lib/branch-context";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, Search, Loader2, Trash2, Edit2, FileText, X, Check, ArrowUpDown, ChevronDown, BellRing, Link2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const BASE_URL = API_URL.replace("/api", "");
const STATUS_FILTERS = ["All Status", "Active", "Inactive"] as const;
const SUBTLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function MembersContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const { activeBranchId } = useBranchScope();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortOrder, setSortOrder] = useState<MemberSortOrder>("asc");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editNumberValue, setEditNumberValue] = useState("");
  const [extraPagesState, setExtraPagesState] = useState<{
    branchKey: string;
    rows: any[];
    cursor: string | null;
    hasMore: boolean;
  }>({ branchKey: activeBranchId, rows: [], cursor: null, hasMore: false });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["members", activeBranchId],
    queryFn: () => fetchMembers({ sort: "asc", limit: 100 }),
  });

  const activeExtraRows = useMemo(
    () => (extraPagesState.branchKey === activeBranchId ? extraPagesState.rows : []),
    [extraPagesState, activeBranchId]
  );
  const nextCursor =
    extraPagesState.branchKey === activeBranchId && extraPagesState.rows.length > 0
      ? extraPagesState.cursor
      : data?.meta?.nextCursor ?? null;
  const hasMore =
    extraPagesState.branchKey === activeBranchId && extraPagesState.rows.length > 0
      ? extraPagesState.hasMore
      : Boolean(data?.meta?.hasMore);
  const totalBranchMembers = data?.meta?.total ?? (data?.data?.length ?? 0);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextRes = await fetchMembers({ sort: "asc", limit: 100, cursor: nextCursor });
      const incoming = Array.isArray(nextRes?.data) ? nextRes.data : [];
      setExtraPagesState((prev) => {
        const currentRows = prev.branchKey === activeBranchId ? prev.rows : [];
        return {
          branchKey: activeBranchId,
          rows: [...currentRows, ...incoming],
          cursor: nextRes?.meta?.nextCursor ?? null,
          hasMore: Boolean(nextRes?.meta?.hasMore),
        };
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load additional members");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const viewMemberId = searchParams.get("viewMember");

  useEffect(() => {
    if (viewMemberId && data?.data) {
      const member = data.data.find((m: any) => m.id === viewMemberId);
      if (member) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedMember(member);
      }
    }
  }, [viewMemberId, data]);

  // Allow closing member drawer via Escape key
  useEffect(() => {
    if (!selectedMember) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedMember(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMember]);

  const updateNumberMutation = useMutation({
    mutationFn: ({ id, memberNo }: { id: string; memberNo: string }) =>
      updateMember(id, { memberId: memberNo }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      setEditingMemberId(null);
      toast.success(`Member No. updated to ${variables.memberNo}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update Member No.");
    },
  });

  const handleSaveMemberNo = (id: string) => {
    if (!editNumberValue.trim()) {
      toast.error("Member No. cannot be empty");
      return;
    }
    updateNumberMutation.mutate({ id, memberNo: editNumberValue.trim() });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast.success("Member deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete member");
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name.trim()}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const [remindingMemberId, setRemindingMemberId] = useState<string | null>(null);
  const [copyingLinkMemberId, setCopyingLinkMemberId] = useState<string | null>(null);
  const [renderNowMs] = useState<number>(() => Date.now());
  const copyRenewalLinkMutation = useMutation({
    mutationFn: (memberId: string) => createMemberRenewalLink(memberId),
    onMutate: (memberId) => setCopyingLinkMemberId(memberId),
    onSuccess: async (res) => {
      const url = res.data.renewalUrl;
      let copied = false;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch {
          copied = false;
        }
      }
      toast.success(
        copied
          ? `Signed renewal link copied for #${res.data.memberCode}`
          : `Renewal link ready: ${url}`
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to generate renewal link");
    },
    onSettled: () => setCopyingLinkMemberId(null),
  });
  const sendReminderMutation = useMutation({
    mutationFn: (memberId: string) => sendManualReminder({ memberId }),
    onMutate: (memberId) => setRemindingMemberId(memberId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notificationLogs"] });
      const sentCount = res.data.results.filter((r) => r.status === "SENT").length;
      const skippedCount = res.data.results.filter((r) => r.status === "SKIPPED").length;
      if (sentCount > 0) {
        toast.success(
          `Reminder sent to ${res.data.memberName} (${sentCount} channel${sentCount === 1 ? "" : "s"}${res.data.dryRun ? ", dry-run" : ""})`
        );
      } else if (skippedCount > 0) {
        toast.info(`Reminder already sent or skipped for ${res.data.memberName} in this cycle`);
      } else {
        toast.error(`Failed to deliver reminder to ${res.data.memberName}. Check Reminders log to retry.`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to send reminder");
    },
    onSettled: () => setRemindingMemberId(null),
  });

  const isEligibleForRenewalReminder = (member: any): boolean => {
    const latestSub = member.memberProfile?.subscriptions?.[0];
    if (!latestSub?.endDate) return false;
    if (latestSub.status === "EXPIRED") return true;
    const msLeft = new Date(latestSub.endDate).getTime() - renderNowMs;
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    return daysLeft <= 7;
  };

  const members = useMemo(() => {
    const base = data?.data ?? [];
    if (activeExtraRows.length === 0) return base;
    const seenIds = new Set(base.map((m: any) => m.id));
    return [...base, ...activeExtraRows.filter((m: any) => !seenIds.has(m.id))];
  }, [data?.data, activeExtraRows]);
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredMembers = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase().trim();
    const matched = members.filter((member: any) => {
      const nameMatch = `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchLower);
      const emailMatch = member.email.toLowerCase().includes(searchLower);
      const idMatch = member.memberProfile?.memberId?.toLowerCase().includes(searchLower) || false;
      const isMemberActive =
        member.memberProfile?.subscriptions?.some((sub: any) => sub.status === "ACTIVE") || false;

      let matchesStatus = true;
      if (statusFilter === "Active") matchesStatus = isMemberActive;
      if (statusFilter === "Inactive") matchesStatus = !isMemberActive;

      return (nameMatch || emailMatch || idMatch) && matchesStatus;
    });

    return sortMembers(matched, sortOrder);
  }, [members, deferredSearch, statusFilter, sortOrder]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: SUBTLE_EASE }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-5 pb-6 border-b border-border"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <p className="font-mono-metric text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Roster Directory
            </p>
            {!isLoading && (
              <span className="font-mono-metric text-[11px] px-2.5 py-0.5 rounded-full bg-secondary border border-border text-foreground/80">
                {filteredMembers.length} / {members.length}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Members Management
          </h1>
          <p className="text-muted-foreground text-sm">
            View and manage all registered gym members, IDs, and membership plans.
          </p>
        </div>

        <Link
          href="/admin/members/new"
          className="touch-target gap-2 px-6 rounded-xl bg-[#D4FF00] text-[#0A0A0C] hover:brightness-105 font-bold text-sm transition-all duration-200 volt-glow-sm focus-volt w-full md:w-auto shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add New Member
        </Link>
      </motion.div>

      {/* Streamlined Action Bar: Search + Filter Pills + Sort Selector */}
      <div className="glass-panel p-4 flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search by name, email, or Member No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-background border border-border rounded-xl pl-10 pr-16 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[#D4FF00] focus:outline-none transition-colors"
            aria-label="Search members by name, email, or Member No."
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-metric text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded focus-volt"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
          {/* Minimal Filter Pills */}
          <div
            role="group"
            aria-label="Filter members by subscription status"
            className="flex flex-wrap items-center gap-2"
          >
            {STATUS_FILTERS.map((filterOption) => {
              const isSelected = statusFilter === filterOption;
              return (
                <button
                  key={filterOption}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setStatusFilter(filterOption)}
                  className={`touch-target px-4 rounded-xl text-xs font-semibold transition-all duration-200 focus-volt border ${
                    isSelected
                      ? "bg-[#D4FF00] text-[#0A0A0C] border-[#D4FF00] font-bold"
                      : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  {filterOption}
                </button>
              );
            })}
          </div>

          {/* Sort Order Selector (Natural Numeric ID & Recency) */}
          <div className="relative flex items-center">
            <ArrowUpDown
              className="pointer-events-none absolute left-3 w-3.5 h-3.5 text-[#D4FF00]"
              aria-hidden="true"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as MemberSortOrder)}
              aria-label="Sort members list"
              className="h-11 min-w-[215px] bg-background border border-border rounded-xl pl-9 pr-9 font-mono-metric text-xs font-semibold text-foreground hover:border-foreground/25 focus:border-[#D4FF00] focus:outline-none transition-colors cursor-pointer appearance-none focus-volt"
            >
              <option value="asc">Ascending (001 → Last)</option>
              <option value="desc">Descending (Last → 001)</option>
              <option value="latest">Recently Added / Latest</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 w-3.5 h-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* High-Utility Data Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Member No.
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Member Name
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Email & Phone
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Gender
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Status
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td className="px-6 py-4">
                        <div className="h-4 w-20 bg-secondary animate-pulse rounded" />
                      </td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-secondary animate-pulse rounded-full shrink-0" />
                        <div className="h-4 w-32 bg-secondary animate-pulse rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-40 bg-secondary animate-pulse rounded mb-2" />
                        <div className="h-3 w-24 bg-secondary animate-pulse rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-16 bg-secondary animate-pulse rounded" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-20 bg-secondary animate-pulse rounded-full" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <div className="h-9 w-9 bg-secondary animate-pulse rounded-xl" />
                          <div className="h-9 w-9 bg-secondary animate-pulse rounded-xl" />
                          <div className="h-9 w-9 bg-secondary animate-pulse rounded-xl" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!isLoading && filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">No members found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try clearing your search filter or register a new member.
                    </p>
                  </td>
                </tr>
              )}

              {filteredMembers.map((member: any) => {
                const latestSub = member.memberProfile?.subscriptions?.[0];
                const isActive =
                  member.memberProfile?.subscriptions?.some((sub: any) => sub.status === "ACTIVE") ||
                  false;

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-[#F5F5F7]/[0.03] transition-colors duration-200 group"
                  >
                    {/* Member ID (JetBrains Mono + Inline Edit Preserved) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingMemberId === member.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editNumberValue}
                            onChange={(e) => setEditNumberValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveMemberNo(member.id);
                              } else if (e.key === "Escape") {
                                setEditingMemberId(null);
                              }
                            }}
                            autoFocus
                            disabled={updateNumberMutation.isPending}
                            className="w-28 bg-background border border-[#D4FF00] rounded-lg px-2.5 py-1.5 font-mono-metric text-xs text-foreground focus:outline-none"
                            placeholder="e.g. 101"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveMemberNo(member.id)}
                            disabled={updateNumberMutation.isPending}
                            className="p-2 text-[#D4FF00] hover:bg-[#D4FF00]/10 rounded-lg transition-colors focus-volt"
                            title="Save (Enter)"
                            aria-label="Save Member No."
                          >
                            {updateNumberMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            disabled={updateNumberMutation.isPending}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-volt"
                            title="Cancel (Esc)"
                            aria-label="Cancel editing Member No."
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/id">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemberId(member.id);
                              setEditNumberValue(member.memberProfile?.memberId || "");
                            }}
                            className="font-mono-metric font-bold text-xs tracking-wide text-[#D4FF00] hover:underline focus-volt rounded"
                            title="Click to edit Member No."
                          >
                            {member.memberProfile?.memberId || "N/A"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMemberId(member.id);
                              setEditNumberValue(member.memberProfile?.memberId || "");
                            }}
                            className="opacity-0 group-hover/id:opacity-100 focus-visible:opacity-100 p-1.5 text-muted-foreground hover:text-[#D4FF00] hover:bg-[#D4FF00]/10 rounded-lg transition-all focus-volt"
                            title="Edit Member No."
                            aria-label={`Edit Member No. for ${member.firstName}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Member Name (Plus Jakarta Sans) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="flex items-center gap-3.5 hover:text-[#D4FF00] transition-colors text-left focus-volt rounded-xl pr-2"
                      >
                        {member.memberProfile?.photoUrl ? (
                          <Image
                            src={
                              member.memberProfile.photoUrl.startsWith("http")
                                ? member.memberProfile.photoUrl
                                : `${BASE_URL}${member.memberProfile.photoUrl}`
                            }
                            alt={`${member.firstName} ${member.lastName}`}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                            unoptimized
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center font-mono-metric text-[#D4FF00] font-bold text-xs shrink-0">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </div>
                        )}
                        <span className="font-semibold text-foreground group-hover:text-[#D4FF00] transition-colors">
                          {member.firstName} {member.lastName}
                        </span>
                      </button>
                    </td>

                    {/* Email & Phone */}
                    <td className="px-6 py-4">
                      <p className="text-foreground text-sm">{member.email}</p>
                      <p className="font-mono-metric text-muted-foreground text-xs mt-1">
                        {member.phone || "N/A"}
                      </p>
                    </td>

                    {/* Gender */}
                    <td className="px-6 py-4 text-muted-foreground capitalize whitespace-nowrap">
                      {member.memberProfile?.gender?.toLowerCase() || "N/A"}
                    </td>

                    {/* Status & Latest Plan (Strict 3-Color Badges + JetBrains Mono) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                            isActive
                              ? "bg-[#D4FF00]/12 text-[#D4FF00] border-[#D4FF00]/30"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-[#D4FF00]" : "bg-muted-foreground/50"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                        {latestSub?.plan?.name && (
                          <span className="font-mono-metric text-[11px] text-muted-foreground pl-1">
                            {latestSub.plan.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {isEligibleForRenewalReminder(member) && (
                          <button
                            type="button"
                            disabled={
                              remindingMemberId === member.id ||
                              member.memberProfile?.notificationsEnabled === false
                            }
                            onClick={() => sendReminderMutation.mutate(member.id)}
                            className="touch-target text-[#D4FF00] hover:bg-[#D4FF00]/12 transition-colors rounded-xl focus-volt disabled:opacity-40"
                            title={
                              member.memberProfile?.notificationsEnabled === false
                                ? "Notifications opted out by member"
                                : "Send Renewal Reminder (WhatsApp / Email)"
                            }
                            aria-label={`Send reminder to ${member.firstName}`}
                          >
                            {remindingMemberId === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <BellRing className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                          <Link
                            href={`/admin/members/${member.id}/plan`}
                            className="touch-target text-muted-foreground hover:text-[#D4FF00] transition-colors rounded-xl hover:bg-[#D4FF00]/10 focus-volt"
                            title="Assign Plan"
                            aria-label={`Assign membership plan for ${member.firstName}`}
                          >
                            <FileText className="w-4 h-4" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            disabled={copyingLinkMemberId === (member.memberProfile?.id || member.id)}
                            onClick={() => copyRenewalLinkMutation.mutate(member.memberProfile?.id || member.id)}
                            className="touch-target text-muted-foreground hover:text-[#D4FF00] transition-colors rounded-xl hover:bg-[#D4FF00]/10 focus-volt disabled:opacity-40"
                            title="Copy Renewal Link"
                            aria-label={`Copy renewal link for ${member.firstName}`}
                          >
                            {copyingLinkMemberId === (member.memberProfile?.id || member.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Link2 className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        <Link
                          href={`/admin/members/${member.id}/edit`}
                          className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary focus-volt"
                          title="Edit Member"
                          aria-label={`Edit profile for ${member.firstName}`}
                        >
                          <Edit2 className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(member.id, member.firstName)}
                          className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary focus-volt"
                          title="Delete Member"
                          aria-label={`Delete member ${member.firstName}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && hasMore && (
          <div className="px-6 py-4 border-t border-border bg-secondary/25 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-mono-metric text-xs text-muted-foreground">
              Showing {members.length.toLocaleString()} of {totalBranchMembers.toLocaleString()} branch members
            </p>
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="touch-target px-5 rounded-xl border border-[#D4FF00]/40 bg-[#D4FF00]/10 text-[#D4FF00] hover:bg-[#D4FF00]/20 font-mono-metric text-xs font-bold transition-colors focus-volt disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              Load Next 100 Members
            </button>
          </div>
        )}
      </div>

      {/* Member Details Obsidian Glass Slide-Over Drawer */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedMember(null)}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Member profile for ${selectedMember.firstName} ${selectedMember.lastName}`}
              initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
              animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.25, ease: SUBTLE_EASE }}
              className="relative z-10 w-full max-w-md h-full obsidian-glass border-l border-[#F5F5F7]/10 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div>
                {/* Drawer Top Bar */}
                <div className="flex items-center justify-between pb-5 border-b border-border">
                  <span className="font-mono-metric text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Athlete Dossier
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="touch-target text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors focus-volt"
                    aria-label="Close member details drawer"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                {/* Member Avatar & Identity */}
                <div className="flex flex-col items-center text-center pt-8 pb-6 border-b border-border">
                  {selectedMember.memberProfile?.photoUrl ? (
                    <Image
                      src={
                        selectedMember.memberProfile.photoUrl.startsWith("http")
                          ? selectedMember.memberProfile.photoUrl
                          : `${BASE_URL}${selectedMember.memberProfile.photoUrl}`
                      }
                      alt={`${selectedMember.firstName} ${selectedMember.lastName}`}
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#D4FF00]/40 mb-4"
                      unoptimized
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-secondary border-2 border-[#D4FF00]/30 flex items-center justify-center font-display text-[#D4FF00] font-extrabold text-3xl mb-4">
                      {selectedMember.firstName.charAt(0)}
                      {selectedMember.lastName.charAt(0)}
                    </div>
                  )}

                  <h3 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono-metric text-xs font-bold text-[#D4FF00] px-2.5 py-0.5 rounded-md bg-[#D4FF00]/10 border border-[#D4FF00]/25">
                      {selectedMember.memberProfile?.memberId || "Pending ID"}
                    </span>
                    {selectedMember.memberProfile?.subscriptions?.[0]?.plan?.name && (
                      <span className="font-mono-metric text-xs text-muted-foreground px-2.5 py-0.5 rounded-md bg-secondary border border-border">
                        {selectedMember.memberProfile.subscriptions[0].plan.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Structured Profile Attributes */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="bg-secondary/40 p-3.5 rounded-xl border border-border col-span-2">
                    <p className="font-mono-metric text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Email
                    </p>
                    <p className="text-sm font-medium text-foreground truncate" title={selectedMember.email}>
                      {selectedMember.email}
                    </p>
                  </div>
                  <div className="bg-secondary/40 p-3.5 rounded-xl border border-border">
                    <p className="font-mono-metric text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Phone
                    </p>
                    <p className="font-mono-metric text-sm font-medium text-foreground truncate">
                      {selectedMember.phone || "N/A"}
                    </p>
                  </div>
                  <div className="bg-secondary/40 p-3.5 rounded-xl border border-border">
                    <p className="font-mono-metric text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Gender
                    </p>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {selectedMember.memberProfile?.gender?.toLowerCase() || "N/A"}
                    </p>
                  </div>
                  <div className="bg-secondary/40 p-3.5 rounded-xl border border-border">
                    <p className="font-mono-metric text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Blood Group
                    </p>
                    <p className="font-mono-metric text-sm font-medium text-foreground">
                      {selectedMember.memberProfile?.bloodGroup || "N/A"}
                    </p>
                  </div>
                  <div className="bg-secondary/40 p-3.5 rounded-xl border border-border">
                    <p className="font-mono-metric text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                      Joined Date
                    </p>
                    <p className="font-mono-metric text-sm font-medium text-foreground">
                      {selectedMember.memberProfile?.joiningDate
                        ? new Date(selectedMember.memberProfile.joiningDate).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Drawer Sticky Actions */}
              <div className="mt-8 pt-5 border-t border-border space-y-2.5">
                <button
                  type="button"
                  disabled={
                    remindingMemberId === selectedMember.id ||
                    selectedMember.memberProfile?.notificationsEnabled === false
                  }
                  onClick={() => sendReminderMutation.mutate(selectedMember.id)}
                  className="w-full touch-target gap-2 bg-secondary/80 hover:border-[#D4FF00]/50 border border-border text-foreground font-semibold text-sm rounded-xl transition-colors focus-volt disabled:opacity-45"
                >
                  {remindingMemberId === selectedMember.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4FF00]" aria-hidden="true" />
                  ) : (
                    <BellRing className="w-4 h-4 text-[#D4FF00]" aria-hidden="true" />
                  )}
                  {selectedMember.memberProfile?.notificationsEnabled === false
                    ? "Reminders Opted Out"
                    : "Send Reminder (WhatsApp / Email)"}
                </button>
                <button
                  type="button"
                  disabled={copyingLinkMemberId === (selectedMember.memberProfile?.id || selectedMember.id)}
                  onClick={() => copyRenewalLinkMutation.mutate(selectedMember.memberProfile?.id || selectedMember.id)}
                  className="w-full touch-target gap-2 bg-secondary/80 hover:border-[#D4FF00]/50 border border-border text-foreground font-semibold text-sm rounded-xl transition-colors focus-volt disabled:opacity-45"
                >
                  {copyingLinkMemberId === (selectedMember.memberProfile?.id || selectedMember.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4FF00]" aria-hidden="true" />
                  ) : (
                    <Link2 className="w-4 h-4 text-[#D4FF00]" aria-hidden="true" />
                  )}
                  Copy One-Click Renewal Link
                </button>
                <div className="flex gap-3">
                  <Link
                    href={`/admin/members/${selectedMember.id}/edit`}
                    className="flex-1 touch-target bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-sm rounded-xl transition-colors text-center focus-volt"
                  >
                    Edit Profile
                  </Link>
                  <Link
                    href={`/admin/members/${selectedMember.id}/plan`}
                    className="flex-1 touch-target bg-[#D4FF00] hover:brightness-105 text-[#0A0A0C] font-bold text-sm rounded-xl transition-all text-center volt-glow-sm focus-volt"
                  >
                    Manage Plan
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-7 h-7 animate-spin text-[#D4FF00]" aria-hidden="true" />
        </div>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
