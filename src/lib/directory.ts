import { getList } from "./frappe";
import { priorityKeyFromValue, type PriorityKey } from "./pricing";
import { loadSettings } from "./settings";

/**
 * Directory of pickable people/companies for the wizard.
 * Frappe-backed when configured; mock data otherwise so the app is fully
 * usable before credentials exist. Server-side cache keeps pickers instant.
 */

export interface DirectoryEmployee {
  id: string;
  name: string;
  designation: string | null;
  ctcAnnual: number | null;
  monthlyCost: number | null;
}

export interface DirectoryCustomer {
  id: string;
  name: string;
  priorityRaw: string;
  priorityKey: PriorityKey;
}

export interface DirectorySupplier {
  id: string;
  name: string;
  monthlyRate: number | null;
}

export type DirectorySource = "frappe" | "mock";

export interface DirectoryResult<T> {
  source: DirectorySource;
  fetchedAt: string;
  /** Set when Frappe is configured but the fetch failed (E5) — mock/stale served instead. */
  degraded?: string;
  items: T[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  result: DirectoryResult<unknown>;
}

const cache = new Map<string, CacheEntry>();

export function frappeConfigured(): boolean {
  const s = loadSettings();
  return Boolean(s.frappe.url && s.frappe.apiKey && s.frappe.apiSecret);
}

async function cached<T>(
  key: string,
  refresh: boolean,
  fetcher: () => Promise<DirectoryResult<T>>
): Promise<DirectoryResult<T>> {
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.result as DirectoryResult<T>;
  }
  try {
    const result = await fetcher();
    cache.set(key, { at: Date.now(), result });
    return result;
  } catch (err) {
    // Frappe down: serve stale cache if any, else fall back to empty frappe
    // result with a degraded note. Mock fetchers never throw.
    const message = err instanceof Error ? err.message : String(err);
    if (hit) {
      return { ...(hit.result as DirectoryResult<T>), degraded: message };
    }
    return { source: "frappe", fetchedAt: new Date().toISOString(), degraded: message, items: [] };
  }
}

export async function listEmployees(refresh = false): Promise<DirectoryResult<DirectoryEmployee>> {
  if (!frappeConfigured()) {
    const { mockEmployees } = await import("./mock-data");
    return { source: "mock", fetchedAt: new Date().toISOString(), items: mockEmployees };
  }
  const settings = loadSettings();
  const ctcField = settings.fields.employeeCtc;
  return cached("employees", refresh, async () => {
    const rows = await getList<Record<string, unknown>>("Employee", {
      fields: ["name", "employee_name", "designation", ctcField],
      filters: [["status", "=", "Active"]],
      limit: 500,
      orderBy: "employee_name asc",
    });
    return {
      source: "frappe" as const,
      fetchedAt: new Date().toISOString(),
      items: rows.map((r) => {
        const ctc = toNumber(r[ctcField]);
        return {
          id: String(r.name),
          name: String(r.employee_name ?? r.name),
          designation: r.designation ? String(r.designation) : null,
          ctcAnnual: ctc,
          monthlyCost: ctc !== null && ctc > 0 ? Math.round(ctc / 12) : null,
        };
      }),
    };
  });
}

export async function listCustomers(refresh = false): Promise<DirectoryResult<DirectoryCustomer>> {
  if (!frappeConfigured()) {
    const { mockCustomers } = await import("./mock-data");
    return { source: "mock", fetchedAt: new Date().toISOString(), items: mockCustomers };
  }
  const settings = loadSettings();
  const prioField = settings.fields.customerPriority;
  return cached("customers", refresh, async () => {
    const rows = await getList<Record<string, unknown>>("Customer", {
      fields: ["name", "customer_name", prioField],
      filters: [["disabled", "=", 0]],
      limit: 500,
      orderBy: "customer_name asc",
    });
    return {
      source: "frappe" as const,
      fetchedAt: new Date().toISOString(),
      items: rows.map((r) => {
        const raw = r[prioField] ? String(r[prioField]) : "P3 - Standard";
        return {
          id: String(r.name),
          name: String(r.customer_name ?? r.name),
          priorityRaw: raw,
          priorityKey: priorityKeyFromValue(raw),
        };
      }),
    };
  });
}

export async function listSuppliers(refresh = false): Promise<DirectoryResult<DirectorySupplier>> {
  if (!frappeConfigured()) {
    const { mockSuppliers } = await import("./mock-data");
    return { source: "mock", fetchedAt: new Date().toISOString(), items: mockSuppliers };
  }
  const settings = loadSettings();
  const rateField = settings.fields.supplierRate;
  const flagField = settings.fields.supplierIsConsultant;
  return cached("suppliers", refresh, async () => {
    const rows = await getList<Record<string, unknown>>("Supplier", {
      fields: ["name", "supplier_name", rateField],
      filters: [
        ["disabled", "=", 0],
        [flagField, "=", 1],
      ],
      limit: 500,
      orderBy: "supplier_name asc",
    });
    return {
      source: "frappe" as const,
      fetchedAt: new Date().toISOString(),
      items: rows.map((r) => ({
        id: String(r.name),
        name: String(r.supplier_name ?? r.name),
        monthlyRate: toNumber(r[rateField]),
      })),
    };
  });
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
