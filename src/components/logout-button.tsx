"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  /** "compact" renders an icon-only button for the mobile top bar. */
  variant?: "full" | "compact";
}

export default function LogoutButton({ variant = "full" }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors — still send the user to /login.
    } finally {
      router.replace("/login");
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-label={loading ? "Logging out…" : "Log out"}
        title="Log out"
        className="flex flex-none items-center justify-center rounded-sm border border-border p-2 text-muted transition duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <LogoutIcon />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="w-full rounded-sm border border-border px-3 py-2 text-left text-sm text-muted transition duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.5}>
      <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 11 14 8l-3.5-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
