import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiBaseUrl, SESSION_COOKIE, type SessionUser } from "@/lib/session";

/**
 * Reports who the current visitor is, as `{ user: SessionUser | null }`.
 *
 * The header calls this from the client rather than reading cookies during
 * render, which is what keeps the content pages statically generated —
 * touching cookies() in the layout would opt every route into dynamic
 * rendering. The answer is never cached, since it is per-visitor.
 */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  try {
    const apiResponse = await fetch(`${apiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!apiResponse.ok) {
      // Expired or revoked. Report signed-out and clear the dead cookie so
      // the browser stops sending it on every subsequent request.
      const response = NextResponse.json({ user: null });
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }

    const user = (await apiResponse.json()) as SessionUser;
    return NextResponse.json({ user });
  } catch {
    // API unreachable. Leave the cookie alone — the session may well still be
    // valid once the API is back, and clearing it would sign the user out
    // over a transient blip.
    return NextResponse.json({ user: null }, { status: 503 });
  }
}
