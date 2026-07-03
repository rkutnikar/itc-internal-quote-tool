import {
  FrappeError,
  callMethod,
  getList,
  type FrappeConnection,
} from "./frappe";
import type { Settings } from "./settings";

export interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skipped";
  detail: string;
  fix?: string;
}

/**
 * Runs the full connection diagnostic against a Frappe instance.
 * Each check produces a specific fix-it hint so any existing Frappe site
 * can be wired up from the Settings screen alone.
 */
export async function runConnectionTest(
  conn: FrappeConnection,
  settings: Settings
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Reachability (ping needs no auth)
  try {
    await callMethod("ping", { ...conn, apiKey: "", apiSecret: "" });
    results.push({
      id: "reachability",
      label: "Server reachable",
      status: "pass",
      detail: `Frappe responded at ${conn.url}`,
    });
  } catch (err) {
    results.push({
      id: "reachability",
      label: "Server reachable",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
      fix: "Check the URL (include https://) and that the site is up. No trailing path needed.",
    });
    return results.concat(
      skipRemaining(["auth", "employee", "customer", "supplier", "quote-doctype"])
    );
  }

  // 2. Token auth
  try {
    const res = await callMethod<{ message: string }>(
      "frappe.auth.get_logged_user",
      conn
    );
    results.push({
      id: "auth",
      label: "API credentials valid",
      status: "pass",
      detail: `Authenticated as ${res.message}`,
    });
  } catch (err) {
    results.push({
      id: "auth",
      label: "API credentials valid",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
      fix: "Regenerate keys: Frappe → User → API Access → Generate Keys. Paste both key and secret.",
    });
    return results.concat(
      skipRemaining(["employee", "customer", "supplier", "quote-doctype"])
    );
  }

  // 3–5. Doctype + custom field access
  const doctypeChecks: {
    id: string;
    doctype: string;
    fields: string[];
    customField: { name: string; label: string } | null;
    fix: string;
  }[] = [
    {
      id: "employee",
      doctype: "Employee",
      fields: ["name", "employee_name", settings.fields.employeeCtc],
      customField: { name: settings.fields.employeeCtc, label: "CTC field" },
      fix: `Add a Currency custom field "${settings.fields.employeeCtc}" to Employee (Customize Form), or change the fieldname in Settings → Field Mapping. Also grant the API user read access to Employee.`,
    },
    {
      id: "customer",
      doctype: "Customer",
      fields: ["name", "customer_name", settings.fields.customerPriority],
      customField: {
        name: settings.fields.customerPriority,
        label: "Priority field",
      },
      fix: `Add a Select custom field "${settings.fields.customerPriority}" to Customer with options P1 - Strategic / P2 - Preferred / P3 - Standard, or change the fieldname in Settings → Field Mapping.`,
    },
    {
      id: "supplier",
      doctype: "Supplier",
      fields: [
        "name",
        "supplier_name",
        settings.fields.supplierRate,
        settings.fields.supplierIsConsultant,
      ],
      customField: {
        name: settings.fields.supplierRate,
        label: "Monthly rate field",
      },
      fix: `Add custom fields "${settings.fields.supplierRate}" (Currency) and "${settings.fields.supplierIsConsultant}" (Check) to Supplier, or change fieldnames in Settings → Field Mapping. External consultants can also be entered manually, so this is a warning, not a blocker.`,
    },
  ];

  for (const check of doctypeChecks) {
    // Base doctype access first, then with custom fields, so failures are precise.
    try {
      await getList(check.doctype, { fields: ["name"], limit: 1 }, conn);
    } catch (err) {
      results.push({
        id: check.id,
        label: `${check.doctype} access`,
        status: check.id === "supplier" ? "warn" : "fail",
        detail: frappeDetail(err),
        fix: `Grant the API user's role read permission on ${check.doctype} (Role Permission Manager).`,
      });
      continue;
    }
    try {
      await getList(check.doctype, { fields: check.fields, limit: 1 }, conn);
      results.push({
        id: check.id,
        label: `${check.doctype} access + fields`,
        status: "pass",
        detail: `Read OK, ${check.customField?.label ?? "fields"} found (${check.fields.join(", ")})`,
      });
    } catch (err) {
      results.push({
        id: check.id,
        label: `${check.doctype} custom fields`,
        status: check.id === "supplier" ? "warn" : "fail",
        detail: frappeDetail(err),
        fix: check.fix,
      });
    }
  }

  // 6. Consultant Quote doctype (read + create permission)
  try {
    await getList("Consultant Quote", { fields: ["name"], limit: 1 }, conn);
    results.push({
      id: "quote-doctype",
      label: "Consultant Quote doctype",
      status: "pass",
      detail: "Doctype exists and is readable. Quotes will sync to Frappe.",
    });
  } catch (err) {
    const isMissing =
      err instanceof FrappeError && (err.status === 404 || err.status === 417);
    results.push({
      id: "quote-doctype",
      label: "Consultant Quote doctype",
      status: "warn",
      detail: isMissing
        ? "Doctype not found on this site."
        : frappeDetail(err),
      fix: "Import frappe-fixtures/README.md instructions (bench import or manual creation). Until then, quotes are stored locally only.",
    });
  }

  return results;
}

function frappeDetail(err: unknown): string {
  if (err instanceof FrappeError) {
    return err.frappeMessages[0] ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function skipRemaining(ids: string[]): CheckResult[] {
  const labels: Record<string, string> = {
    auth: "API credentials valid",
    employee: "Employee access",
    customer: "Customer access",
    supplier: "Supplier access",
    "quote-doctype": "Consultant Quote doctype",
  };
  return ids.map((id) => ({
    id,
    label: labels[id] ?? id,
    status: "skipped" as const,
    detail: "Skipped — fix earlier failures first.",
  }));
}
