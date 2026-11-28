"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry";
import { ErrorFallbackCard } from "@/components/ErrorFallbackCard";

export default function GlobalError({
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
    <html lang="en" className="dark">
      <body className="bg-[#0A0A0C] text-[#F5F5F7] antialiased min-h-screen">
        <ErrorFallbackCard
          title="Studio Interface Interrupted"
          subtitle="A critical client error occurred. Recover cleanly below without losing stored session data."
          digest={error.digest}
          onReset={reset}
          fallbackHref="/login"
          fallbackLabel="Back to Sign In"
        />
      </body>
    </html>
  );
}
