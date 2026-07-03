"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-paper px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 banknote-rule" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 banknote-rule" />

      <div className="w-full max-w-sm animate-rise text-center">
        <p className="ledger-stamp inline-block px-4 text-xs text-ink">Error</p>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted">
          The page hit an unexpected error. You can try again.
        </p>
        {error.message && (
          <p className="mt-3 text-xs text-muted/80">{error.message}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
