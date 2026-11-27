import type { QueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "lakzee_swr_cache_v1";
const CACHE_VERSION = 1;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const PERSISTABLE_ROOT_KEYS = new Set([
  "dashboardStats",
  "members",
  "plans",
  "subscriptions",
  "paymentStats",
  "expenses",
  "reports",
  "attendance",
  "settings",
  "announcements",
  "myProfile",
  "myAttendance",
  "mySubscriptions",
  "myWorkoutRoutine",
  "myDietPlan",
]);

const PUBLIC_ROOT_KEYS = new Set(["plans", "settings"]);

interface PersistedEntry {
  queryKey: readonly unknown[];
  data: unknown;
  updatedAt: number;
}

interface PersistedEnvelope {
  version: number;
  userId: string | null;
  savedAt: number;
  entries: Record<string, PersistedEntry>;
}

function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("lakzee_token");
    const rawUser = localStorage.getItem("lakzee_user");
    if (!token || !rawUser) return null;
    const parsed = JSON.parse(rawUser) as { id?: string };
    return typeof parsed?.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

export function clearPersistedQueryCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors in private browsing
  }
}

/**
 * Hydrates persisted SWR query snapshots synchronously post-mount so pages render
 * in 0ms while marking snapshots stale so fresh data is revalidated in background.
 */
export function hydrateQueryCacheFromStorage(
  queryClient: QueryClient,
  staleOffsetMs = 60_000
): void {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const envelope = JSON.parse(raw) as PersistedEnvelope;
    if (
      !envelope ||
      envelope.version !== CACHE_VERSION ||
      typeof envelope.savedAt !== "number" ||
      Date.now() - envelope.savedAt > MAX_CACHE_AGE_MS
    ) {
      clearPersistedQueryCache();
      return;
    }

    const activeUserId = getActiveUserId();
    // Prevent leaking authenticated cache across accounts or after logout
    if (envelope.userId && activeUserId && envelope.userId !== activeUserId) {
      clearPersistedQueryCache();
      return;
    }

    const now = Date.now();
    for (const entry of Object.values(envelope.entries ?? {})) {
      if (!entry || !Array.isArray(entry.queryKey) || entry.data === undefined) continue;
      const rootKey = String(entry.queryKey[0] ?? "");
      if (!PERSISTABLE_ROOT_KEYS.has(rootKey)) continue;
      if (!activeUserId && !PUBLIC_ROOT_KEYS.has(rootKey)) continue;

      if (queryClient.getQueryData(entry.queryKey) === undefined) {
        // Clamp updatedAt into the past so React Query shows 0ms snapshot & silently revalidates
        const hydratedUpdatedAt = Math.min(entry.updatedAt || now, now - staleOffsetMs);
        queryClient.setQueryData(entry.queryKey, entry.data, {
          updatedAt: hydratedUpdatedAt,
        });
      }
    }
  } catch {
    clearPersistedQueryCache();
  }
}

export function subscribeQueryCachePersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flushToStorage = () => {
    flushTimer = null;
    try {
      const userId = getActiveUserId();
      const entries: Record<string, PersistedEntry> = {};

      for (const query of queryClient.getQueryCache().getAll()) {
        if (query.state.status !== "success" || query.state.data === undefined) continue;
        const rootKey = String(query.queryKey[0] ?? "");
        if (!PERSISTABLE_ROOT_KEYS.has(rootKey)) continue;
        if (!userId && !PUBLIC_ROOT_KEYS.has(rootKey)) continue;

        entries[query.queryHash] = {
          queryKey: query.queryKey,
          data: query.state.data,
          updatedAt: query.state.dataUpdatedAt || Date.now(),
        };
      }

      const envelope: PersistedEnvelope = {
        version: CACHE_VERSION,
        userId,
        savedAt: Date.now(),
        entries,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // Ignore quota exceeded or storage restrictions
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event?.type === "updated" ||
      event?.type === "removed" ||
      event?.type === "added"
    ) {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(flushToStorage, 150);
    }
  });

  return () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
    }
    unsubscribe();
  };
}
