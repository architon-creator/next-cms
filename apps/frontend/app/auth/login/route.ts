import { NextRequest, NextResponse } from "next/server";

import { missingOidcEnv, oidcConfig, TMP_COOKIE_NAME } from "@/lib/oidc/config";
import {
  challengeOf,
  discovery,
  LOGIN_STATE_TTL_SECONDS,
  rand,
  safeReturnTo,
  signLoginState,
} from "@/lib/oidc/oidc";

// Step 1 of the Authorization Code + PKCE flow: send the browser to the
// vendor's login page. state / nonce / code_verifier are kept in a short-lived
// HttpOnly cookie and checked again in the callback.
export async function GET(req: NextRequest) {
  const cfg = oidcConfig();
  if (missingOidcEnv().length > 0) {
    return NextResponse.json(
      { error: "oidc_not_configured", missing: missingOidcEnv() },
      { status: 503 },
    );
  }

  let d;
  try {
    d = await discovery();
  } catch {
    return NextResponse.redirect(
      new URL("/login-error?reason=idp_unreachable", cfg.appBaseUrl),
      302,
    );
  }

  const state = rand();
  const nonce = rand();
  const verifier = rand();
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));

  const url = new URL(d.authorization_endpoint);
  // Keep any query the vendor's endpoint already has.
  new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scope,
    state,
    nonce,
    code_challenge: challengeOf(verifier),
    code_challenge_method: "S256",
  }).forEach((value, key) => url.searchParams.set(key, value));

  const res = NextResponse.redirect(url, 302);
  res.cookies.set(TMP_COOKIE_NAME, signLoginState({ state, nonce, verifier, returnTo }), {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: "lax", // must be Lax: the return trip is a cross-site navigation
    path: "/auth",
    maxAge: LOGIN_STATE_TTL_SECONDS,
  });
  return res;
}
