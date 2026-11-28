"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry";
import { ErrorFallbackCard } from "@/components/ErrorFallbackCard";

export default function AppSegmentError({
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
      digest={error.digest}
      onReset={reset}
      fallbackHref="/"
      fallbackLabel="Studio Home"
    />
  );
}
