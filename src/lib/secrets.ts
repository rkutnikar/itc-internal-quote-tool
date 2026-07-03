import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR =
  process.env.DATA_DIR ?? path.join(process.cwd(), "data");

/** Wraps fs writes so a read-only filesystem (Vercel) fails with advice. */
export function writeDataFile(fileName: string, content: string): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, fileName), content, { mode: 0o600 });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new Error(
        "The server filesystem is read-only, so settings and local quotes cannot be saved here. " +
          "On Vercel, configure via environment variables (SESSION_SECRET, APP_PASSWORD, FRAPPE_*) " +
          "and connect Frappe so quotes are stored there — see README."
      );
    }
    throw err;
  }
}

/**
 * Session/encryption secret resolution:
 * 1. SESSION_SECRET env var (required in production — Vercel fs is ephemeral)
 * 2. data/secret file, generated on first run (local dev convenience)
 * 3. in-memory fallback when the filesystem is read-only (sessions reset on
 *    each cold start — the login page keeps working instead of crashing)
 */
let memorySecret: string | null = null;

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }
  const secretFile = path.join(DATA_DIR, "secret");
  try {
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, "utf8").trim();
    }
    const secret = crypto.randomBytes(32).toString("hex");
    writeDataFile("secret", secret);
    return secret;
  } catch {
    if (!memorySecret) {
      memorySecret = crypto.randomBytes(32).toString("hex");
      console.warn(
        "SESSION_SECRET is not set and the filesystem is not writable; using an " +
          "in-memory secret. Sessions and saved settings will reset on every cold " +
          "start — set the SESSION_SECRET env var in production."
      );
    }
    return memorySecret;
  }
}

function deriveKey(): Buffer {
  return crypto.scryptSync(getSessionSecret(), "itc-quote-tool-settings", 32);
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
