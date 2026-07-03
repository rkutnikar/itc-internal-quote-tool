"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "checking" | "login" | "setup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Sign in — ITC Quote Tool";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not reach the server.");
        const data = (await res.json()) as {
          loggedIn: boolean;
          setupRequired: boolean;
        };
        if (cancelled) return;
        if (data.loggedIn) {
          router.replace("/dashboard");
          return;
        }
        setMode(data.setupRequired ? "setup" : "login");
      } catch {
        if (!cancelled) {
          setMode("login");
          setError("Could not reach the server. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (mode !== "checking") passwordRef.current?.focus();
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "setup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "setup"
            ? { password, confirmPassword }
            : { password }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-paper px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 banknote-rule" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 banknote-rule" />

      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 text-center">
          <p className="ledger-stamp inline-block px-4 text-xs text-ink">
            ITC &middot; Internal
          </p>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-ink">
            Quote Tool
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "setup"
              ? "Set a shared password for your team."
              : "Enter the team password to continue."}
          </p>
        </div>

        <div className="ledger-card rounded-sm p-8">
          {mode === "checking" ? (
            <p className="text-center text-sm text-muted">Checking session&hellip;</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted">
                  {mode === "setup" ? "New password" : "Password"}
                </label>
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "setup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
                />
              </div>

              {mode === "setup" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-sm bg-warning-light px-3 py-2 text-sm text-warning">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 inline-flex w-full items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Please wait…"
                  : mode === "setup"
                    ? "Set password & continue"
                    : "Log in"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Consultant quote generation, kept in the ledger.
        </p>
      </div>
    </div>
  );
}
