import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { loadSettings, publicSettings, saveSettings } from "@/lib/settings";
import { hashPassword } from "@/lib/secrets";
import { pricingConfigSchema } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  return NextResponse.json(publicSettings(loadSettings()));
}

const fieldnameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_]*$/,
    "Fieldname may contain only letters, numbers and underscores"
  );

const updateSchema = z.object({
  frappe: z
    .object({
      url: z.string().trim(),
      apiKey: z.string().trim(),
      // Empty string means "keep existing secret"
      apiSecret: z.string().trim().optional(),
    })
    .optional(),
  fields: z
    .object({
      customerPriority: fieldnameSchema,
      employeeCtc: fieldnameSchema,
      supplierRate: fieldnameSchema,
      supplierIsConsultant: fieldnameSchema,
    })
    .optional(),
  general: z
    .object({
      currency: z.string().trim().min(1).max(8),
      quoteValidityDays: z.number().int().min(1).max(365),
    })
    .optional(),
  pricing: pricingConfigSchema.optional(),
  document: z
    .object({
      companyName: z.string().trim().max(120),
      companyAddress: z.string().trim().max(400),
      termsText: z.string().trim().max(4000),
      footerNote: z.string().trim().max(300),
      showDiscount: z.boolean(),
    })
    .optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PUT(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings payload.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const settings = loadSettings();
  const update = parsed.data;

  if (update.frappe) {
    settings.frappe.url = update.frappe.url.replace(/\/+$/, "");
    settings.frappe.apiKey = update.frappe.apiKey;
    if (update.frappe.apiSecret) settings.frappe.apiSecret = update.frappe.apiSecret;
  }
  if (update.fields) settings.fields = update.fields;
  if (update.general) settings.general = update.general;
  if (update.pricing) settings.pricing = update.pricing;
  if (update.document) settings.document = update.document;
  if (update.newPassword) {
    if (process.env.APP_PASSWORD) {
      return NextResponse.json(
        { error: "Password is set via APP_PASSWORD env var — change it there." },
        { status: 400 }
      );
    }
    settings.auth.passwordHash = hashPassword(update.newPassword);
  }

  try {
    saveSettings(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save settings." },
      { status: 500 }
    );
  }
  return NextResponse.json(publicSettings(settings));
}
