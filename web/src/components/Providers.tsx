"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import {
  hydrateQueryCacheFromStorage,
  subscribeQueryCachePersistence,
} from "@/lib/query-persistence";

const SWR_STALE_TIME_MS = 15 * 1000;
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 0ms cached renders on navigation/reopen, followed by silent background revalidation
        staleTime: SWR_STALE_TIME_MS,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const hasHydratedRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    if (!hasHydratedRef.current) {
      hydrateQueryCacheFromStorage(queryClient, SWR_STALE_TIME_MS + 45_000);
      hasHydratedRef.current = true;
    }
    return subscribeQueryCachePersistence(queryClient);
  }, [queryClient]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
