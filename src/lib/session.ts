import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionSecret } from "./secrets";

export interface SessionData {
  loggedIn?: boolean;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), {
    password: getSessionSecret(),
    cookieName: "itc-quote-session",
    ttl: 60 * 60 * 12, // 12h
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function requireSession(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session.loggedIn);
}
