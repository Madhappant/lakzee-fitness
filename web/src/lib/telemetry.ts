const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type WebVitalMetricName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type WebVitalRating = "good" | "needs-improvement" | "poor";

export interface TelemetryBreadcrumb {
  category: "navigation" | "api" | "ui";
  message: string;
  timestamp: string;
}

const MAX_BREADCRUMBS = 15;
const breadcrumbs: TelemetryBreadcrumb[] = [];

function maskSensitiveText(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .slice(0, 480);
}

export function addTelemetryBreadcrumb(
  category: TelemetryBreadcrumb["category"],
  message: string
): void {
  if (typeof window === "undefined") return;
  if (breadcrumbs.length >= MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
  breadcrumbs.push({
    category,
    message: maskSensitiveText(message),
    timestamp: new Date().toISOString(),
  });
}

export function getTelemetryBreadcrumbs(): readonly TelemetryBreadcrumb[] {
  return breadcrumbs;
}

export function rateWebVital(name: WebVitalMetricName, value: number): WebVitalRating {
  switch (name) {
    case "LCP":
      return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "INP":
      return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "CLS":
      return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "FCP":
      return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    case "TTFB":
      return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
  }
}

function dispatchBeacon(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  const endpoint = `${API_BASE_URL}/telemetry/client`;
  const serialized = JSON.stringify(payload);

  try {
    // Non-blocking background transport; never attaches auth tokens or cookies
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([serialized], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry is strictly non-fatal
  }
}

export function reportClientError(
  error: unknown,
  context: { route?: string; componentStack?: string } = {}
): void {
  if (typeof window === "undefined") return;

  const errObj = error instanceof Error ? error : new Error(String(error ?? "Client exception"));
  const safeMessage = maskSensitiveText(errObj.message || "Unexpected application error");
  const isChunkError =
    errObj.name === "ChunkLoadError" || /loading chunk|dynamically imported module/i.test(safeMessage);

  addTelemetryBreadcrumb("ui", `${isChunkError ? "ChunkLoadError" : errObj.name}: ${safeMessage}`);

  dispatchBeacon({
    type: "error",
    route: (context.route || window.location.pathname || "/").split("?")[0],
    message: safeMessage,
    stack: errObj.stack ? maskSensitiveText(errObj.stack).slice(0, 1500) : undefined,
    componentStack: context.componentStack ? maskSensitiveText(context.componentStack).slice(0, 1000) : undefined,
  });
}

export function startWebVitalsObserver(getRoute: () => string): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  const emitted = new Set<string>();
  let latestLcp = 0;
  let clsTotal = 0;
  let maxInp = 0;

  const sendVital = (name: WebVitalMetricName, value: number) => {
    const route = (getRoute() || "/").split("?")[0];
    const key = `${name}:${route}`;
    if (emitted.has(key)) return;
    emitted.add(key);

    dispatchBeacon({
      type: "web-vital",
      name,
      value: Math.round(value * 1000) / 1000,
      rating: rateWebVital(name, value),
      route,
    });
  };

  const observers: PerformanceObserver[] = [];

  try {
    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navEntry && navEntry.responseStart > 0) {
      sendVital("TTFB", navEntry.responseStart);
    }
  } catch {
    // Ignore unsupported navigation timing
  }

  const observeType = (type: string, cb: (list: PerformanceObserverEntryList) => void) => {
    try {
      const supported = PerformanceObserver.supportedEntryTypes || [];
      if (!supported.includes(type)) return;
      const obs = new PerformanceObserver(cb);
      obs.observe({ type, buffered: true } as PerformanceObserverInit);
      observers.push(obs);
    } catch {
      // Ignore browser-specific observer restrictions
    }
  };

  observeType("paint", (list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-contentful-paint") {
        sendVital("FCP", entry.startTime);
      }
    }
  });

  observeType("largest-contentful-paint", (list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) latestLcp = last.startTime;
  });

  observeType("layout-shift", (list) => {
    for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
      if (!entry.hadRecentInput && typeof entry.value === "number") {
        clsTotal += entry.value;
      }
    }
  });

  observeType("event", (list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > maxInp) {
        maxInp = entry.duration;
      }
    }
  });

  const flushOnHide = () => {
    if (document.visibilityState !== "hidden") return;
    if (latestLcp > 0) sendVital("LCP", latestLcp);
    sendVital("CLS", clsTotal);
    if (maxInp > 0) sendVital("INP", maxInp);
  };

  document.addEventListener("visibilitychange", flushOnHide);

  return () => {
    document.removeEventListener("visibilitychange", flushOnHide);
    for (const obs of observers) {
      try {
        obs.disconnect();
      } catch {
        // No-op
      }
    }
  };
}
