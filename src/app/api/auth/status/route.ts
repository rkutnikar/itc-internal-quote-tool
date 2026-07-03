import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { storageAvailable } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const settings = await loadSettings();
  const passwordSet =
    Boolean(process.env.APP_PASSWORD) || settings.auth.passwordHash.length > 0;
  return NextResponse.json({
    loggedIn: Boolean(session.loggedIn),
    setupRequired: !passwordSet,
    // False when nowhere to persist (read-only fs AND no Blob store):
    // first-run setup can't save a password — env vars or Blob required.
    storageWritable: storageAvailable(),
  });
}
