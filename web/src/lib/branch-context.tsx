"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACTIVE_BRANCH_STORAGE_KEY,
  getStoredActiveBranch,
  setStoredActiveBranch,
} from "./api/config";

interface BranchContextValue {
  activeBranchId: string;
  setActiveBranchId: (branchId: string) => void;
  refreshBranchScope: () => void;
}

const BranchContext = createContext<BranchContextValue>({
  activeBranchId: "all",
  setActiveBranchId: () => undefined,
  refreshBranchScope: () => undefined,
});

function resolveInitialBranchForCurrentUser(): string {
  if (typeof window === "undefined") return "all";
  try {
    const rawUser = localStorage.getItem("lakzee_user");
    if (!rawUser) return "all";
    const parsed = JSON.parse(rawUser) as { role?: string; branchId?: string | null };
    if (parsed?.role === "SUPER_ADMIN") {
      return getStoredActiveBranch();
    }
    return parsed?.branchId || "branch-primary-001";
  } catch {
    return "all";
  }
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeBranchId, setActiveBranchState] = useState<string>("all");

  const refreshBranchScope = useCallback(() => {
    setActiveBranchState(resolveInitialBranchForCurrentUser());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBranchScope();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_BRANCH_STORAGE_KEY || e.key === "lakzee_user") {
        refreshBranchScope();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshBranchScope]);

  const setActiveBranchId = useCallback(
    (nextBranchId: string) => {
      const normalized = nextBranchId.trim() || "all";
      setStoredActiveBranch(normalized);
      setActiveBranchState(normalized);
      // Immediately revalidate all active studio queries under the newly selected branch scope
      void queryClient.invalidateQueries();
    },
    [queryClient]
  );

  return (
    <BranchContext.Provider value={{ activeBranchId, setActiveBranchId, refreshBranchScope }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchScope() {
  return useContext(BranchContext);
}
