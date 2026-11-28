"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchNotificationLogs,
  retryNotificationLog,
  runRemindersBatch,
} from "@/lib/api/notifications";
import type { NotificationLogRecord } from "@/lib/api/types";
import { useBranchScope } from "@/lib/branch-context";

const STATUS_FILTERS = ["ALL", "SENT", "FAILED", "SKIPPED"] as const;
const CHANNEL_FILTERS = ["ALL", "WHATSAPP", "EMAIL"] as const;

const MILESTONE_LABELS: Record<string, string> = {
  "7_DAYS": "7 Days Left",
  "3_DAYS": "3 Days Left",
  "1_DAY": "1 Day Left",
  EXPIRED: "Expired Today",
};

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const { activeBranchId } = useBranchScope();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [channelFilter, setChannelFilter] = useState<(typeof CHANNEL_FILTERS)[number]>("ALL");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notificationLogs", activeBranchId],
    queryFn: () => fetchNotificationLogs({ limit: 100 }),
  });

  const logs: NotificationLogRecord[] = useMemo(() => data?.data ?? [], [data?.data]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
      if (channelFilter !== "ALL" && entry.channel !== channelFilter) return false;
      return true;
    });
  }, [logs, statusFilter, channelFilter]);

  const counts = useMemo(() => {
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const item of logs) {
      if (item.status === "SENT") sent += 1;
      else if (item.status === "FAILED") failed += 1;
      else skipped += 1;
    }
    return { total: logs.length, sent, failed, skipped };
  }, [logs]);

  const runBatchMutation = useMutation({
    mutationFn: (dryRun: boolean) => runRemindersBatch({ dryRun }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notificationLogs"] });
      const s = res.data;
      toast.success(
        `${s.dryRun ? "[Dry-Run] " : ""}Sweep done (${s.targetDate}): ${s.sent} sent, ${s.failed} failed, ${s.skippedDuplicate} skipped`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to execute reminder batch");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryNotificationLog(id),
    onMutate: (id) => setRetryingId(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notificationLogs"] });
      if (res.data.status === "SENT") {
        toast.success(`Retried ${res.data.channel} reminder successfully`);
      } else {
        toast.error(res.data.reason || "Retry attempt failed again");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Retry failed");
    },
    onSettled: () => setRetryingId(null),
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <p className="font-mono-metric text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Automation Console
            </p>
            <span className="font-mono-metric text-[11px] px-2.5 py-0.5 rounded-full bg-secondary border border-border text-foreground/80">
              {counts.total} logs
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Expiry Reminders & Delivery Logs
          </h1>
          <p className="text-muted-foreground text-sm">
            Track idempotent WhatsApp and Email renewal deliveries, trigger dry-run sweeps, and retry failed sends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/settings"
            className="touch-target gap-2 px-4 rounded-xl bg-secondary border border-border text-foreground hover:border-foreground/25 text-xs font-semibold transition-colors focus-volt"
          >
            <Settings className="w-4 h-4 text-[#D4FF00]" aria-hidden="true" />
            Channel Rules
          </Link>
          <button
            type="button"
            disabled={runBatchMutation.isPending}
            onClick={() => runBatchMutation.mutate(true)}
            className="touch-target gap-2 px-4 rounded-xl bg-secondary border border-border text-foreground hover:border-[#D4FF00]/50 font-mono-metric text-xs font-bold transition-colors focus-volt disabled:opacity-50"
          >
            {runBatchMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4FF00]" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#D4FF00]" aria-hidden="true" />
            )}
            Dry-Run Sweep
          </button>
          <button
            type="button"
            disabled={runBatchMutation.isPending}
            onClick={() => runBatchMutation.mutate(false)}
            className="touch-target gap-2 px-5 rounded-xl bg-[#D4FF00] text-[#0A0A0C] hover:brightness-105 font-bold text-sm transition-all volt-glow-sm focus-volt disabled:opacity-50"
          >
            <BellRing className="w-4 h-4" aria-hidden="true" />
            Run Live Sweep
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 space-y-1">
          <p className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
            Logged Attempts
          </p>
          <p className="font-display text-3xl font-extrabold text-foreground">{counts.total}</p>
        </div>
        <div className="glass-panel p-5 space-y-1">
          <p className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
            Delivered (Sent)
          </p>
          <p className="font-display text-3xl font-extrabold text-[#D4FF00]">{counts.sent}</p>
        </div>
        <div className="glass-panel p-5 space-y-1">
          <p className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
            Failed (Retryable)
          </p>
          <p className="font-display text-3xl font-extrabold text-foreground">{counts.failed}</p>
        </div>
        <div className="glass-panel p-5 space-y-1">
          <p className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
            Skipped (Idempotent / Unset)
          </p>
          <p className="font-display text-3xl font-extrabold text-muted-foreground">{counts.skipped}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter logs by delivery status">
          {STATUS_FILTERS.map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(st)}
                className={`touch-target px-4 rounded-xl font-mono-metric text-xs font-bold border transition-all focus-volt ${
                  active
                    ? "bg-[#D4FF00] text-[#0A0A0C] border-[#D4FF00]"
                    : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CHANNEL_FILTERS.map((ch) => {
            const active = channelFilter === ch;
            return (
              <button
                key={ch}
                type="button"
                aria-pressed={active}
                onClick={() => setChannelFilter(ch)}
                className={`touch-target px-3.5 rounded-xl font-mono-metric text-xs font-semibold border transition-all focus-volt ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {ch}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="touch-target px-3 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors focus-volt"
            aria-label="Refresh delivery logs"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#D4FF00]" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Delivery Logs Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Member
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Channel
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Milestone
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Status
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium">
                  Timestamp
                </th>
                <th className="px-6 py-4 font-mono-metric text-[11px] uppercase tracking-wider font-medium text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#D4FF00] mx-auto" aria-hidden="true" />
                  </td>
                </tr>
              )}

              {!isLoading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">No notification deliveries logged yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trigger a Dry-Run Sweep or send a manual reminder from the Members directory.
                    </p>
                  </td>
                </tr>
              )}

              {filteredLogs.map((log) => {
                const fullName = log.member?.user
                  ? `${log.member.user.firstName} ${log.member.user.lastName}`
                  : log.memberId;
                const memberNo = log.member?.memberId ? `#${log.member.memberId}` : "";
                const isSent = log.status === "SENT";
                const isFailed = log.status === "FAILED";

                return (
                  <tr key={log.id} className="hover:bg-[#F5F5F7]/[0.03] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {memberNo && (
                          <span className="font-mono-metric text-xs font-bold text-[#D4FF00]">
                            {memberNo}
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{fullName}</p>
                          <p className="font-mono-metric text-[11px] text-muted-foreground">
                            {log.channel === "WHATSAPP"
                              ? log.member?.whatsappNumber || log.member?.user?.phone || "No WhatsApp"
                              : log.member?.user?.email || "No Email"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono-metric text-xs font-semibold text-foreground px-2.5 py-1 rounded-lg bg-secondary border border-border">
                        {log.channel === "WHATSAPP" ? (
                          <MessageSquare className="w-3.5 h-3.5 text-[#D4FF00]" aria-hidden="true" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                        )}
                        {log.channel}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-mono-metric text-xs text-foreground">
                      <div>
                        <span>{MILESTONE_LABELS[log.milestone] || log.milestone}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Cycle {new Date(log.cycleExpiryDate).toLocaleDateString()}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono-metric text-xs font-bold border ${
                          isSent
                            ? "bg-[#D4FF00]/12 text-[#D4FF00] border-[#D4FF00]/35"
                            : isFailed
                              ? "bg-secondary text-[#F5F5F7] border-[#F5F5F7]/40"
                              : "bg-secondary/50 text-muted-foreground border-border"
                        }`}
                      >
                        {isSent ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#D4FF00]" aria-hidden="true" />
                        ) : isFailed ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-[#F5F5F7]" aria-hidden="true" />
                        ) : null}
                        {log.status}
                      </span>
                      {log.errorMessage && (
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-xs truncate" title={log.errorMessage}>
                          {log.errorMessage}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-mono-metric text-xs text-muted-foreground">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {isFailed ? (
                        <button
                          type="button"
                          disabled={retryingId === log.id}
                          onClick={() => retryMutation.mutate(log.id)}
                          className="touch-target inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-[#D4FF00]/50 bg-[#D4FF00]/10 text-[#D4FF00] hover:bg-[#D4FF00]/20 font-mono-metric text-xs font-bold transition-colors focus-volt disabled:opacity-50"
                          aria-label={`Retry ${log.channel} reminder`}
                        >
                          {retryingId === log.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          Retry
                        </button>
                      ) : (
                        <span className="font-mono-metric text-[11px] text-muted-foreground/70">
                          {log.providerMessageId ? `id:${log.providerMessageId.slice(0, 12)}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
