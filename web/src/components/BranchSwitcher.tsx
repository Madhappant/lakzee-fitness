"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createBranch, fetchBranches } from "@/lib/api/branches";
import type { BranchRecord } from "@/lib/api/types";
import { useBranchScope } from "@/lib/branch-context";

/**
 * Minimal Obsidian / Chalk / Golden Yellow branch switcher & branch provisioner
 * strictly gated to SUPER_ADMIN accounts in the Admin Dashboard header.
 */
export function BranchSwitcher({ userRole }: { userRole: string | null }) {
  const queryClient = useQueryClient();
  const { activeBranchId, setActiveBranchId } = useBranchScope();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");

  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const { data } = useQuery({
    queryKey: ["branches"],
    queryFn: fetchBranches,
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  const branches: BranchRecord[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: (res) => {
      const created = res.data;
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success(`Branch ${created.code} created`);
      setIsModalOpen(false);
      setName("");
      setCode("");
      setLocation("");
      setActiveBranchId(created.id);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create branch");
    },
  });

  if (!isSuperAdmin) return null;

  const handleSelectChange = (value: string) => {
    if (value === "__new__") {
      setIsModalOpen(true);
      return;
    }
    setActiveBranchId(value);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      toast.error("Branch name and location are required");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
      location: location.trim(),
      status: "ACTIVE",
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <Building2
            className="pointer-events-none absolute left-2.5 sm:left-3 w-3.5 h-3.5 text-[#DBA12C]"
            aria-hidden="true"
          />
          <select
            value={activeBranchId}
            onChange={(e) => handleSelectChange(e.target.value)}
            aria-label="Switch active branch"
            className="h-10 w-[112px] sm:w-auto sm:min-w-[175px] sm:max-w-[230px] apple-glass rounded-xl pl-7 sm:pl-8 pr-6 sm:pr-7 font-mono-metric text-[11px] sm:text-xs font-semibold text-foreground hover:border-[#DBA12C]/50 focus:border-[#DBA12C] focus:outline-none transition-colors cursor-pointer appearance-none focus-gold truncate"
          >
            <option value="all">All Branches (Global)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Add Branch"
          aria-label="Add new gym branch"
          className="h-10 w-10 rounded-xl apple-glass hover:border-[#DBA12C]/60 text-muted-foreground hover:text-[#F2C14E] flex items-center justify-center transition-colors focus-gold shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add New Gym Branch"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0A0A0C]/75 backdrop-blur-md"
        >
          <div className="w-[calc(100%-1.5rem)] sm:w-full max-w-md rounded-3xl apple-glass-elevated text-foreground p-6 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <p className="font-mono-metric text-[10px] uppercase tracking-[0.18em] text-[#DBA12C]">
                  Multi-Branch Network
                </p>
                <h3 className="font-display text-lg font-extrabold tracking-tight">
                  Provision Gym Branch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close branch modal"
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-gold"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
                  Branch Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Anna Nagar Flagship"
                  className="w-full h-11 rounded-xl border border-border bg-secondary/40 px-3.5 text-sm text-foreground focus:border-[#DBA12C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
                    Branch Code
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Auto (e.g. BR-002)"
                    className="w-full h-11 rounded-xl border border-border bg-secondary/40 px-3.5 font-mono-metric text-sm text-foreground focus:border-[#DBA12C] focus:outline-none uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono-metric text-[11px] uppercase tracking-wider text-muted-foreground">
                    Location / City
                  </label>
                  <input
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Chennai West"
                    className="w-full h-11 rounded-xl border border-border bg-secondary/40 px-3.5 text-sm text-foreground focus:border-[#DBA12C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="h-11 px-5 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2 transition-all focus-gold gold-glow-sm"
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  )}
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
