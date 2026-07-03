/**
 * Shared client-side fetch helper for authed pages.
 *
 * - Throws an Error (with the server's `error` message when present) on any
 *   non-OK response.
 * - On a 401 (session expired mid-use), redirects to /login via
 *   window.location.assign so all client state resets, then throws to stop
 *   the caller's flow.
 * - Returns the parsed JSON body on success.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });

  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Session expired. Redirecting to sign in…");
  }

  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!res.ok || data === null) {
    throw new Error((data as { error?: string } | null)?.error ?? "Request failed.");
  }

  return data;
}
