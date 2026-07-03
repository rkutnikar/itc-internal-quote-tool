import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_DIR, decrypt, encrypt, writeDataFile } from "./secrets";
import { pricingConfigSchema } from "./pricing";

/**
 * App settings live in an encrypted file at data/settings.enc so the whole
 * tool is configurable from the Settings screen without redeploys.
 *
 * Env vars override file values (recommended on Vercel, where the filesystem
 * is ephemeral): FRAPPE_URL, FRAPPE_API_KEY, FRAPPE_API_SECRET, APP_PASSWORD.
 */

/** Frappe fieldnames are snake_case identifiers — reject anything else. */
function fieldname() {
  return z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      "Fieldname may contain only letters, numbers and underscores"
    );
}

export const settingsSchema = z.object({
  frappe: z.object({
    url: z.string().trim().default(""),
    apiKey: z.string().trim().default(""),
    apiSecret: z.string().trim().default(""),
  }),
  fields: z.object({
    customerPriority: fieldname().default("custom_priority"),
    employeeCtc: fieldname().default("custom_ctc_annual"),
    supplierRate: fieldname().default("custom_monthly_rate"),
    supplierIsConsultant: fieldname().default("custom_is_consultant"),
  }),
  general: z.object({
    currency: z.string().trim().default("INR"),
    quoteValidityDays: z.number().int().min(1).max(365).default(30),
  }),
  pricing: pricingConfigSchema.prefault({}),
  document: z.object({
    companyName: z.string().trim().max(120).default("Your Company Pvt. Ltd."),
    companyAddress: z.string().trim().max(400).default(""),
    termsText: z
      .string()
      .trim()
      .max(4000)
      .default(
        "This quotation is valid until the date stated above. Rates are exclusive of applicable taxes. " +
          "Invoicing is monthly in arrears with payment due within 30 days. " +
          "Either party may terminate the engagement with 30 days' written notice."
      ),
    footerNote: z.string().trim().max(300).default(""),
    // Print the applied priority discount on the client PDF?
    showDiscount: z.boolean().default(false),
  }).prefault({}),
  auth: z.object({
    // scrypt hash, set from the first-run screen; APP_PASSWORD env overrides
    passwordHash: z.string().default(""),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

const SETTINGS_FILE = path.join(DATA_DIR, "settings.enc");

export function defaultSettings(): Settings {
  return settingsSchema.parse({
    frappe: {},
    fields: {},
    general: {},
    auth: {},
  });
}

export function loadSettings(): Settings {
  let fromFile: Settings = defaultSettings();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = decrypt(fs.readFileSync(SETTINGS_FILE, "utf8"));
      fromFile = settingsSchema.parse(JSON.parse(raw));
    } catch {
      // Corrupt or key changed — fall back to defaults rather than crash.
      fromFile = defaultSettings();
    }
  }
  // Env overrides
  if (process.env.FRAPPE_URL) fromFile.frappe.url = process.env.FRAPPE_URL;
  if (process.env.FRAPPE_API_KEY) fromFile.frappe.apiKey = process.env.FRAPPE_API_KEY;
  if (process.env.FRAPPE_API_SECRET) fromFile.frappe.apiSecret = process.env.FRAPPE_API_SECRET;
  return fromFile;
}

export function saveSettings(settings: Settings): void {
  writeDataFile("settings.enc", encrypt(JSON.stringify(settings)));
}

/** Settings safe to send to the browser — secrets replaced with flags. */
export function publicSettings(s: Settings) {
  return {
    frappe: {
      url: s.frappe.url,
      apiKey: s.frappe.apiKey,
      apiSecretSet: s.frappe.apiSecret.length > 0,
      urlFromEnv: Boolean(process.env.FRAPPE_URL),
      credentialsFromEnv: Boolean(
        process.env.FRAPPE_API_KEY || process.env.FRAPPE_API_SECRET
      ),
    },
    fields: s.fields,
    general: s.general,
    pricing: s.pricing,
    document: s.document,
    auth: {
      passwordSet: Boolean(process.env.APP_PASSWORD) || s.auth.passwordHash.length > 0,
      passwordFromEnv: Boolean(process.env.APP_PASSWORD),
    },
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;
