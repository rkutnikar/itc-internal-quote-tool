import { z } from "zod";
import { decrypt, encrypt } from "./secrets";
import { readDataFile, writeDataFile } from "./storage";
import { loadSettings } from "./settings";
import { frappeConfigured } from "./directory";
import { getDoc, getList, insertDoc, updateDoc } from "./frappe";
import {
  clampRate,
  computePriceSheet,
  priorityKeyFromValue,
  type PriceSheet,
  type QuoteInputs,
} from "./pricing";

/**
 * Quote repository. Source of truth is the Frappe `Consultant Quote` doctype
 * when connected; otherwise (or when Frappe is down — E5) quotes land in an
 * encrypted local file so nothing is ever lost. Local quotes are labelled
 * storage:"local" so the UI can show they haven't reached Frappe.
 */

export const quoteDraftSchema = z.object({
  customer: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    priorityRaw: z.string().min(1),
    priorityKey: z.enum(["p1", "p2", "p3"]),
  }),
  requirement: z.object({
    yearsExperience: z.number().int().min(0).max(50),
    certificationRequired: z.boolean(),
    certificationHeld: z.boolean(),
    skillType: z.enum(["Niche", "Regular"]),
    durationMonths: z.number().int().min(1).max(60),
    budgetPerMonth: z.number().positive().nullable(),
  }),
  resource: z.object({
    type: z.enum(["Internal", "External"]),
    refId: z.string().nullable(), // Employee/Supplier id; null for manual vendor
    name: z.string().min(1),
    monthlyCost: z.number().positive(),
    manualCost: z.boolean(),
  }),
  selection: z.object({
    tier: z.enum(["good", "better", "best", "custom"]),
    finalMonthlyRate: z.number().positive(),
  }),
  preparedBy: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().default(""),
});

export type QuoteDraft = z.infer<typeof quoteDraftSchema>;

export type QuoteStatus =
  | "Draft"
  | "Generated"
  | "Sent"
  | "Approved"
  | "Rejected"
  | "Expired";

export interface QuoteRecord {
  id: string;
  storage: "frappe" | "local";
  status: QuoteStatus;
  createdAt: string;
  validUntil: string;
  draft: QuoteDraft;
  sheet: PriceSheet;
  finalMonthlyRate: number;
  totalContractValue: number;
  currency: string;
}

/**
 * Serializes load-modify-save cycles on the local quote file so concurrent
 * requests can't drop each other's writes. In-process only — sufficient for
 * the single-instance local/dev store this file backs.
 */
let fileLock: Promise<unknown> = Promise.resolve();
function withFileLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = fileLock.then(fn, fn);
  fileLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function loadLocalQuotes(): Promise<QuoteRecord[]> {
  const raw = await readDataFile("quotes.enc");
  if (raw === null) return [];
  try {
    const records = JSON.parse(decrypt(raw)) as QuoteRecord[];
    // Expiry applied at read time so displays are always correct even when
    // the write-back in applyExpiryLocal cannot persist.
    return records.map((q) => {
      if (isExpired(q.status, q.validUntil)) {
        const expired = { ...q, status: "Expired" as const };
        expiredAtRead.add(expired);
        return expired;
      }
      return q;
    });
  } catch {
    return [];
  }
}

async function saveLocalQuotes(quotes: QuoteRecord[]): Promise<void> {
  await writeDataFile("quotes.enc", encrypt(JSON.stringify(quotes)));
}

function nextLocalId(existing: QuoteRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `CQ-${year}-L`;
  const max = existing
    .filter((q) => q.id.startsWith(prefix))
    .reduce((m, q) => Math.max(m, Number(q.id.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/**
 * Create a quote. The price sheet is recomputed server-side from the draft —
 * client-sent prices are never trusted; the final rate is clamped into the
 * valid slider range.
 */
export async function createQuote(draft: QuoteDraft): Promise<QuoteRecord> {
  const settings = await loadSettings();
  const inputs: QuoteInputs = {
    monthlyCost: draft.resource.monthlyCost,
    yearsExperience: draft.requirement.yearsExperience,
    certificationRequired: draft.requirement.certificationRequired,
    certificationHeld: draft.requirement.certificationHeld,
    skillType: draft.requirement.skillType,
    priority: draft.customer.priorityKey,
    durationMonths: draft.requirement.durationMonths,
    budgetPerMonth: draft.requirement.budgetPerMonth,
  };
  const sheet = computePriceSheet(inputs, settings.pricing);
  const finalMonthlyRate = clampRate(
    draft.selection.finalMonthlyRate,
    sheet,
    settings.pricing.roundTo
  );
  const totalContractValue = finalMonthlyRate * draft.requirement.durationMonths;
  const validUntil = new Date(
    Date.now() + settings.general.quoteValidityDays * 86_400_000
  )
    .toISOString()
    .slice(0, 10);

  const base: Omit<QuoteRecord, "id" | "storage"> = {
    status: "Generated",
    createdAt: new Date().toISOString(),
    validUntil,
    draft,
    sheet,
    finalMonthlyRate,
    totalContractValue,
    currency: settings.general.currency,
  };

  if (await frappeConfigured()) {
    try {
      const inserted = await insertDoc<{ name: string }>(
        "Consultant Quote",
        toFrappeDoc(base)
      );
      return { ...base, id: inserted.name, storage: "frappe" };
    } catch {
      // Frappe down or doctype missing — keep the quote locally (E5).
    }
  }
  return withFileLock(async () => {
    const locals = await loadLocalQuotes();
    const record: QuoteRecord = { ...base, id: nextLocalId(locals), storage: "local" };
    locals.unshift(record);
    await saveLocalQuotes(locals);
    return record;
  });
}

/**
 * Lifecycle: Generated → Sent → Approved/Rejected. Expiry is automatic
 * (lazy, applied on read) for Generated/Sent quotes past valid_until.
 * Approved, Rejected and Expired are terminal — revise by cloning.
 */
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ["Generated"],
  Generated: ["Sent", "Approved", "Rejected"],
  Sent: ["Approved", "Rejected"],
  Approved: [],
  Rejected: [],
  Expired: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateQuoteStatus(
  id: string,
  next: QuoteStatus
): Promise<QuoteRecord> {
  const quote = await getQuote(id);
  if (!quote) throw new QuoteNotFoundError(id);
  if (!canTransition(quote.status, next)) {
    throw new InvalidTransitionError(quote.status, next);
  }
  return persistStatus(quote, next);
}

export class QuoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Quote ${id} not found.`);
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Cannot move a quote from ${from} to ${to}.`);
  }
}

async function persistStatus(
  quote: QuoteRecord,
  next: QuoteStatus
): Promise<QuoteRecord> {
  if (quote.storage === "local") {
    return withFileLock(async () => {
      const locals = await loadLocalQuotes();
      const idx = locals.findIndex((q) => q.id === quote.id);
      if (idx === -1) throw new QuoteNotFoundError(quote.id);
      locals[idx] = { ...locals[idx], status: next };
      await saveLocalQuotes(locals);
      return locals[idx];
    });
  }
  await updateDoc("Consultant Quote", quote.id, { status: next });
  return { ...quote, status: next };
}

function isExpired(status: QuoteStatus, validUntil: string): boolean {
  if (status !== "Generated" && status !== "Sent") return false;
  if (!validUntil) return false;
  return validUntil < new Date().toISOString().slice(0, 10);
}

/**
 * Lazy auto-expiry (E10). Persistence is best-effort — on a read-only
 * filesystem the expired status is still shown (loadLocalQuotes maps it),
 * just not written back.
 */
async function applyExpiryLocal(): Promise<void> {
  await withFileLock(async () => {
    const locals = await loadLocalQuotes();
    if (locals.some((q) => q.status === "Expired" && rawStatusWasOpen(q))) {
      try {
        await saveLocalQuotes(locals);
      } catch {
        /* storage unavailable — display already correct */
      }
    }
  });
}

// loadLocalQuotes applies expiry at read time; this marks which records
// changed so applyExpiryLocal knows whether a write-back is needed.
const expiredAtRead = new WeakSet<QuoteRecord>();
function rawStatusWasOpen(q: QuoteRecord): boolean {
  return expiredAtRead.has(q);
}

export interface QuoteListItem {
  id: string;
  storage: "frappe" | "local";
  status: QuoteStatus;
  createdAt: string;
  validUntil: string;
  customerName: string;
  priorityRaw: string;
  resourceName: string;
  resourceType: "Internal" | "External";
  monthlyCost: number;
  finalMonthlyRate: number;
  totalContractValue: number;
  currency: string;
}

export async function listQuotes(): Promise<{ items: QuoteListItem[]; degraded?: string }> {
  const settings = await loadSettings();
  await applyExpiryLocal();
  const localItems = (await loadLocalQuotes()).map(toListItem);
  if (!(await frappeConfigured())) {
    return { items: localItems };
  }
  try {
    const rows = await getList<Record<string, unknown>>("Consultant Quote", {
      fields: [
        "name", "status", "creation", "valid_until", "customer", "customer_priority",
        "resource_name", "resource_type", "monthly_cost", "final_monthly_rate",
        "total_contract_value",
      ],
      limit: 200,
      orderBy: "creation desc",
    });
    const frappeItems: QuoteListItem[] = rows.map((r) => {
      const storedStatus = (r.status as QuoteStatus) ?? "Generated";
      const validUntil = String(r.valid_until ?? "");
      const status = isExpired(storedStatus, validUntil) ? "Expired" : storedStatus;
      if (status !== storedStatus) {
        // Persist the auto-expiry back to Frappe; display is already correct.
        updateDoc("Consultant Quote", String(r.name), { status: "Expired" }).catch(
          () => {}
        );
      }
      return {
        id: String(r.name),
        storage: "frappe" as const,
        status,
        createdAt: String(r.creation ?? ""),
        validUntil,
        customerName: String(r.customer ?? ""),
        priorityRaw: String(r.customer_priority ?? ""),
        resourceName: String(r.resource_name ?? ""),
        resourceType: r.resource_type === "External" ? ("External" as const) : ("Internal" as const),
        monthlyCost: Number(r.monthly_cost) || 0,
        finalMonthlyRate: Number(r.final_monthly_rate) || 0,
        totalContractValue: Number(r.total_contract_value) || 0,
        currency: settings.general.currency,
      };
    });
    return { items: [...localItems, ...frappeItems] };
  } catch (err) {
    return {
      items: localItems,
      degraded: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getQuote(id: string): Promise<QuoteRecord | null> {
  await applyExpiryLocal();
  const local = (await loadLocalQuotes()).find((q) => q.id === id);
  if (local) return local;
  if (!(await frappeConfigured())) return null;
  try {
    const doc = await getDoc<Record<string, unknown>>("Consultant Quote", id);
    const record = await fromFrappeDoc(doc);
    if (isExpired(record.status, record.validUntil)) {
      updateDoc("Consultant Quote", record.id, { status: "Expired" }).catch(() => {});
      return { ...record, status: "Expired" };
    }
    return record;
  } catch {
    return null;
  }
}

function toListItem(q: QuoteRecord): QuoteListItem {
  return {
    id: q.id,
    storage: q.storage,
    status: q.status,
    createdAt: q.createdAt,
    validUntil: q.validUntil,
    monthlyCost: q.draft.resource.monthlyCost,
    customerName: q.draft.customer.name,
    priorityRaw: q.draft.customer.priorityRaw,
    resourceName: q.draft.resource.name,
    resourceType: q.draft.resource.type,
    finalMonthlyRate: q.finalMonthlyRate,
    totalContractValue: q.totalContractValue,
    currency: q.currency,
  };
}

function toFrappeDoc(q: Omit<QuoteRecord, "id" | "storage">): Record<string, unknown> {
  return {
    naming_series: "CQ-.YYYY.-",
    status: q.status,
    customer: q.draft.customer.id,
    customer_priority: q.draft.customer.priorityRaw,
    valid_until: q.validUntil,
    prepared_by: q.draft.preparedBy,
    years_experience: q.draft.requirement.yearsExperience,
    certification_required: q.draft.requirement.certificationRequired ? 1 : 0,
    certification_held: q.draft.requirement.certificationHeld ? 1 : 0,
    skill_type: q.draft.requirement.skillType,
    duration_months: q.draft.requirement.durationMonths,
    budget_per_month: q.draft.requirement.budgetPerMonth ?? 0,
    resource_type: q.draft.resource.type,
    employee: q.draft.resource.type === "Internal" ? q.draft.resource.refId : null,
    supplier: q.draft.resource.type === "External" ? q.draft.resource.refId : null,
    resource_name: q.draft.resource.name,
    monthly_cost: q.draft.resource.monthlyCost,
    manual_cost: q.draft.resource.manualCost ? 1 : 0,
    price_good: q.sheet.tiers.good.monthly,
    price_better: q.sheet.tiers.better.monthly,
    price_best: q.sheet.tiers.best.monthly,
    min_bill_amount: q.sheet.minBill,
    tier_selected: capitalize(q.draft.selection.tier),
    discount_pct_applied: q.sheet.discountPct,
    final_monthly_rate: q.finalMonthlyRate,
    total_contract_value: q.totalContractValue,
    notes: q.draft.notes,
    pricing_config_snapshot: JSON.stringify({ sheet: q.sheet }),
  };
}

async function fromFrappeDoc(doc: Record<string, unknown>): Promise<QuoteRecord> {
  const settings = await loadSettings();
  let sheet: PriceSheet | null = null;
  try {
    const snap = JSON.parse(String(doc.pricing_config_snapshot ?? "{}")) as {
      sheet?: PriceSheet;
    };
    sheet = snap.sheet ?? null;
  } catch {
    /* legacy/hand-edited doc */
  }
  const draft: QuoteDraft = {
    customer: {
      id: String(doc.customer ?? ""),
      name: String(doc.customer ?? ""),
      priorityRaw: String(doc.customer_priority ?? "P3 - Standard"),
      priorityKey: priorityKeyFromValue(String(doc.customer_priority ?? "")),
    },
    requirement: {
      yearsExperience: Number(doc.years_experience) || 0,
      certificationRequired: doc.certification_required === 1,
      certificationHeld: doc.certification_held === 1,
      skillType: doc.skill_type === "Niche" ? "Niche" : "Regular",
      durationMonths: Number(doc.duration_months) || 1,
      budgetPerMonth: Number(doc.budget_per_month) > 0 ? Number(doc.budget_per_month) : null,
    },
    resource: {
      type: doc.resource_type === "External" ? "External" : "Internal",
      refId: (doc.employee ?? doc.supplier) ? String(doc.employee ?? doc.supplier) : null,
      name: String(doc.resource_name ?? ""),
      monthlyCost: Number(doc.monthly_cost) || 1,
      manualCost: doc.manual_cost === 1,
    },
    selection: {
      tier: (String(doc.tier_selected ?? "custom").toLowerCase() as QuoteDraft["selection"]["tier"]) ?? "custom",
      finalMonthlyRate: Number(doc.final_monthly_rate) || 1,
    },
    preparedBy: String(doc.prepared_by ?? ""),
    notes: String(doc.notes ?? ""),
  };
  return {
    id: String(doc.name),
    storage: "frappe",
    status: (doc.status as QuoteStatus) ?? "Generated",
    createdAt: String(doc.creation ?? ""),
    validUntil: String(doc.valid_until ?? ""),
    draft,
    sheet:
      sheet ??
      computePriceSheet(
        {
          monthlyCost: draft.resource.monthlyCost,
          yearsExperience: draft.requirement.yearsExperience,
          certificationRequired: draft.requirement.certificationRequired,
          certificationHeld: draft.requirement.certificationHeld,
          skillType: draft.requirement.skillType,
          priority: draft.customer.priorityKey,
          durationMonths: draft.requirement.durationMonths,
          budgetPerMonth: draft.requirement.budgetPerMonth,
        },
        settings.pricing
      ),
    finalMonthlyRate: Number(doc.final_monthly_rate) || 0,
    totalContractValue: Number(doc.total_contract_value) || 0,
    currency: settings.general.currency,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
