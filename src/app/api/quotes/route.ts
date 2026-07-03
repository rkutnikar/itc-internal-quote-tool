import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createQuote, listQuotes, quoteDraftSchema } from "@/lib/quotes";
import { PricingError } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  return NextResponse.json(await listQuotes());
}

export async function POST(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const parsed = quoteDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote data.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const record = await createQuote(parsed.data);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not save quote: ${message}` },
      { status: 500 }
    );
  }
}
