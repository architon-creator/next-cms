import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/**
 * Drops the session cookie. The API's own /auth/logout is not called: its
 * tokens are stateless, so there is nothing server-side to tear down, and
 * discarding the cookie is what actually ends the session.
 */
export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
