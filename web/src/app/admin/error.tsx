"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry";
import { ErrorFallbackCard } from "@/components/ErrorFallbackCard";

export default function AdminSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <ErrorFallbackCard
      title="Admin View Interrupted"
      subtitle="We captured diagnostic details safely. Retry rendering or jump back to your workspace."
      digest={error.digest}
      onReset={reset}
      fallbackHref="/admin/members"
      fallbackLabel="Open Members"
    />
  );
}
