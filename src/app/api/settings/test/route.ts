import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { getConnection } from "@/lib/frappe";
import { runConnectionTest } from "@/lib/connection-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const settings = await loadSettings();
  if (!settings.frappe.url) {
    return NextResponse.json({
      results: [
        {
          id: "reachability",
          label: "Server reachable",
          status: "fail",
          detail: "No Frappe URL configured.",
          fix: "Enter your Frappe site URL above and save first.",
        },
      ],
    });
  }
  const results = await runConnectionTest(await getConnection(settings), settings);
  return NextResponse.json({ results });
}
