"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  addTelemetryBreadcrumb,
  reportClientError,
  startWebVitalsObserver,
} from "@/lib/telemetry";

/**
 * Passive, zero-overhead client telemetry mount capturing Core Web Vitals,
 * route breadcrumbs, unhandled rejections, and chunk-load errors.
 */
export function TelemetryObserver() {
  const pathname = usePathname();

  useEffect(() => {
    addTelemetryBreadcrumb("navigation", pathname || "/");
  }, [pathname]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      reportClientError(event.error || new Error(event.message || "Unhandled script error"), {
        route: window.location.pathname,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason || new Error("Unhandled promise rejection"), {
        route: window.location.pathname,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);
    const stopVitals = startWebVitalsObserver(() => window.location.pathname || "/");

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
      stopVitals();
    };
  }, []);

  return null;
}
