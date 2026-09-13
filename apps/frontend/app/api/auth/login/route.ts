import { NextResponse } from "next/server";
import { createLogger } from "otel";

import { apiBaseUrl, SESSION_COOKIE, type SessionUser } from "@/lib/session";

const logger = createLogger("api/auth/login");

type ApiLoginResponse = {
  token: string;
  expiresIn: number;
  user: SessionUser;
};

/**
 * Exchanges credentials for a session cookie.
 *
 * The browser posts here rather than to the API directly so the token can be
 * stored httpOnly on this origin — see SESSION_COOKIE. The token itself is
 * never included in the response body.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${apiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch (err) {
    // The API being down is an infrastructure problem, not a bad password —
    // 502 keeps the two distinguishable in logs and in the form's messaging.
    logger.error("Login API unreachable", { apiBaseUrl: apiBaseUrl() }, err);
    return NextResponse.json(
      { error: "Could not reach the login service" },
      { status: 502 },
    );
  }

  if (!apiResponse.ok) {
    const failure = await apiResponse.json().catch(() => ({}));
    // Never log the email/password here — only the outcome.
    logger.warn("Login rejected", { status: apiResponse.status });
    return NextResponse.json(
      { error: (failure as { error?: string }).error || "Login failed" },
      { status: apiResponse.status },
    );
  }

  const { token, expiresIn, user } = (await apiResponse.json()) as ApiLoginResponse;
  logger.info("Login succeeded", { userId: user.id });

  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Matches the token's own lifetime, so the cookie can't outlive the
    // credential it carries and leave the UI showing a stale signed-in state.
    maxAge: expiresIn,
  });

  return response;
}
