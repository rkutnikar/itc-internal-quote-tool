import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./secrets";

/**
 * Data-file storage with two backends:
 *
 * - Local filesystem (`data/`) — default for local dev.
 * - Vercel Blob — used automatically when BLOB_READ_WRITE_TOKEN is present
 *   (create a Blob store in the Vercel dashboard; the token is injected).
 *   Contents are AES-256-GCM encrypted by the callers before they get here,
 *   so blob-store URLs never expose plaintext.
 *
 * A short per-instance read cache keeps request latency down; writes bust it.
 * Note: cross-instance writes can still race for a few seconds — fine for an
 * internal tool; production quotes should live in Frappe, not the blob.
 */

const BLOB_PREFIX = "itc-quote-tool/";
const CACHE_TTL_MS = 5_000;

const readCache = new Map<string, { at: number; value: string | null }>();

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export class StorageError extends Error {}

function friendly(err: unknown): StorageError {
  const detail = err instanceof Error ? err.message : String(err);
  return new StorageError(
    "Could not persist data on this server (read-only filesystem and no Blob store). " +
      "Either set configuration via environment variables, or add a Vercel Blob store " +
      "(Project → Storage → Create → Blob) so the app can save data. " +
      `Underlying error: ${detail}`
  );
}

export async function readDataFile(name: string): Promise<string | null> {
  const hit = readCache.get(name);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value: string | null;
  if (blobEnabled()) {
    value = await blobRead(name);
  } else {
    const file = path.join(DATA_DIR, name);
    value = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  }
  readCache.set(name, { at: Date.now(), value });
  return value;
}

export async function writeDataFile(name: string, content: string): Promise<void> {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(`${BLOB_PREFIX}${name}`, content, {
      access: "public", // URLs are unguessable and payloads are encrypted
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
    });
  } else {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, name), content, { mode: 0o600 });
    } catch (err) {
      throw friendly(err);
    }
  }
  readCache.set(name, { at: Date.now(), value: content });
}

async function blobRead(name: string): Promise<string | null> {
  const { head, BlobNotFoundError } = await import("@vercel/blob");
  try {
    const meta = await head(`${BLOB_PREFIX}${name}`);
    // Cache-bust: blob URLs are CDN-cached; the unique query forces a fresh
    // read so a just-written value is visible immediately.
    const res = await fetch(`${meta.url}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new StorageError(`Blob read failed (HTTP ${res.status})`);
    return await res.text();
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

/** True when saves can persist somewhere (writable disk or blob store). */
export function storageAvailable(): boolean {
  if (blobEnabled()) return true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, ".probe");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
