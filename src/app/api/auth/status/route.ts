import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const settings = loadSettings();
  const passwordSet =
    Boolean(process.env.APP_PASSWORD) || settings.auth.passwordHash.length > 0;
  return NextResponse.json({
    loggedIn: Boolean(session.loggedIn),
    setupRequired: !passwordSet,
  });
}
