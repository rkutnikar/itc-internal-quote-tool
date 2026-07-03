import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/secrets";
import { loadSettings, saveSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(1),
  // Present only on the first-run setup call
  confirmPassword: z.string().optional(),
});

/**
 * Login, plus first-run setup: when no password exists yet (no APP_PASSWORD
 * env and no stored hash), the first call with password+confirmPassword sets
 * the shared password and logs in.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }
  const { password, confirmPassword } = parsed.data;
  const settings = loadSettings();
  const envPassword = process.env.APP_PASSWORD;
  const passwordSet = Boolean(envPassword) || settings.auth.passwordHash.length > 0;

  if (!passwordSet) {
    // First-run setup
    if (confirmPassword === undefined) {
      return NextResponse.json(
        { error: "No password configured yet — confirm it to set up.", setupRequired: true },
        { status: 409 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    settings.auth.passwordHash = hashPassword(password);
    saveSettings(settings);
  } else {
    const ok = envPassword
      ? password === envPassword
      : verifyPassword(password, settings.auth.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
