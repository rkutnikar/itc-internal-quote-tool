import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { listSuppliers } from "@/lib/directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json(await listSuppliers(refresh));
}
