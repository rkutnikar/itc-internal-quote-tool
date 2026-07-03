import { loadSettings, type Settings } from "./settings";

/**
 * Minimal Frappe REST client. Server-side only — credentials must never
 * reach the browser. Uses token auth: `Authorization: token key:secret`.
 */

export class FrappeError extends Error {
  status: number;
  frappeMessages: string[];

  constructor(message: string, status: number, frappeMessages: string[] = []) {
    super(message);
    this.name = "FrappeError";
    this.status = status;
    this.frappeMessages = frappeMessages;
  }
}

export interface FrappeConnection {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export async function getConnection(settings?: Settings): Promise<FrappeConnection> {
  const s = settings ?? (await loadSettings());
  return {
    url: s.frappe.url.replace(/\/+$/, ""),
    apiKey: s.frappe.apiKey,
    apiSecret: s.frappe.apiSecret,
  };
}

/** Extract human-readable messages from a Frappe error response body. */
function parseFrappeMessages(body: unknown): string[] {
  const messages: string[] = [];
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b._server_messages === "string") {
      try {
        for (const raw of JSON.parse(b._server_messages) as string[]) {
          try {
            const parsed = JSON.parse(raw) as { message?: string };
            if (parsed.message) messages.push(stripHtml(parsed.message));
          } catch {
            messages.push(stripHtml(raw));
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof b.exception === "string") messages.push(b.exception);
    if (typeof b.message === "string") messages.push(b.message);
  }
  return messages;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

async function frappeFetch<T>(
  connMaybe: FrappeConnection | undefined,
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const conn = connMaybe ?? (await getConnection());
  if (!conn.url) {
    throw new FrappeError("Frappe URL is not configured. Set it in Settings.", 0);
  }
  let res: Response;
  try {
    res = await fetch(`${conn.url}${path}`, {
      ...init,
      headers: {
        // Omit auth entirely for unauthenticated checks (e.g. ping)
        ...(conn.apiKey
          ? { Authorization: `token ${conn.apiKey}:${conn.apiSecret}` }
          : {}),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new FrappeError(`Could not reach Frappe at ${conn.url}: ${cause}`, 0);
  }

  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const messages = parseFrappeMessages(body);
    throw new FrappeError(
      messages[0] ?? `Frappe returned HTTP ${res.status}`,
      res.status,
      messages
    );
  }
  return body as T;
}

export interface ListOptions {
  fields?: string[];
  filters?: unknown[][];
  limit?: number;
  offset?: number;
  orderBy?: string;
}

export async function getList<T = Record<string, unknown>>(
  doctype: string,
  opts: ListOptions = {},
  conn?: FrappeConnection
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set("fields", JSON.stringify(opts.fields ?? ["name"]));
  if (opts.filters) params.set("filters", JSON.stringify(opts.filters));
  params.set("limit_page_length", String(opts.limit ?? 100));
  if (opts.offset) params.set("limit_start", String(opts.offset));
  if (opts.orderBy) {
    // Defense in depth: only "fieldname [asc|desc]" ever reaches Frappe.
    if (!/^[a-zA-Z0-9_.]+( (asc|desc))?$/i.test(opts.orderBy)) {
      throw new FrappeError(`Invalid order_by: ${opts.orderBy}`, 0);
    }
    params.set("order_by", opts.orderBy);
  }
  const res = await frappeFetch<{ data: T[] }>(
    conn,
    `/api/resource/${encodeURIComponent(doctype)}?${params}`
  );
  return res.data;
}

export async function getDoc<T = Record<string, unknown>>(
  doctype: string,
  name: string,
  conn?: FrappeConnection
): Promise<T> {
  const res = await frappeFetch<{ data: T }>(
    conn,
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  );
  return res.data;
}

export async function insertDoc<T = Record<string, unknown>>(
  doctype: string,
  doc: Record<string, unknown>,
  conn?: FrappeConnection
): Promise<T> {
  const res = await frappeFetch<{ data: T }>(
    conn,
    `/api/resource/${encodeURIComponent(doctype)}`,
    { method: "POST", body: JSON.stringify(doc) }
  );
  return res.data;
}

export async function updateDoc<T = Record<string, unknown>>(
  doctype: string,
  name: string,
  doc: Record<string, unknown>,
  conn?: FrappeConnection
): Promise<T> {
  const res = await frappeFetch<{ data: T }>(
    conn,
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: "PUT", body: JSON.stringify(doc) }
  );
  return res.data;
}

export async function callMethod<T = unknown>(
  method: string,
  conn?: FrappeConnection
): Promise<T> {
  return frappeFetch<T>(conn, `/api/method/${method}`);
}

/**
 * Attach a file to a document via Frappe's upload_file endpoint.
 * Multipart request — must not set Content-Type manually (boundary).
 */
export async function uploadFile(
  opts: {
    fileName: string;
    content: Uint8Array;
    mimeType: string;
    doctype: string;
    docname: string;
    isPrivate?: boolean;
  },
  connMaybe?: FrappeConnection
): Promise<{ name: string; file_url: string }> {
  const conn = connMaybe ?? (await getConnection());
  const form = new FormData();
  form.set(
    "file",
    new Blob([opts.content.buffer as ArrayBuffer], { type: opts.mimeType }),
    opts.fileName
  );
  form.set("doctype", opts.doctype);
  form.set("docname", opts.docname);
  form.set("is_private", opts.isPrivate === false ? "0" : "1");

  let res: Response;
  try {
    res = await fetch(`${conn.url}/api/method/upload_file`, {
      method: "POST",
      headers: { Authorization: `token ${conn.apiKey}:${conn.apiSecret}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new FrappeError(`Could not reach Frappe at ${conn.url}: ${cause}`, 0);
  }
  const body = (await res.json().catch(() => null)) as {
    message?: { name: string; file_url: string };
  } | null;
  if (!res.ok || !body?.message) {
    throw new FrappeError(`File upload failed (HTTP ${res.status})`, res.status);
  }
  return body.message;
}
