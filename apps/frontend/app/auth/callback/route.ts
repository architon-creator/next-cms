import { NextRequest, NextResponse } from "next/server";

import { oidcConfig, SESSION_COOKIE_NAME, TMP_COOKIE_NAME } from "@/lib/oidc/config";
import {
  readLoginState,
  safeReturnTo,
  tokenRequest,
  verifyIdToken,
} from "@/lib/oidc/oidc";
import { getSessionStore } from "@/lib/oidc/session-store";

function fail(reason: string) {
  const res = NextResponse.redirect(
    new URL(`/login-error?reason=${encodeURIComponent(reason)}`, oidcConfig().appBaseUrl),
    302,
  );
  res.cookies.set(TMP_COOKIE_NAME, "", { path: "/auth", maxAge: 0 });
  return res;
}

// Step 2: the vendor sends the browser back here with ?code&state. Check the
// state, trade the code (+ PKCE verifier) for tokens on the server, validate
// the ID token, then create the session. The browser only ever gets the
// session id cookie.
export async function GET(req: NextRequest) {
  const cfg = oidcConfig();
  const sp = req.nextUrl.searchParams;
  const raw = req.cookies.get(TMP_COOKIE_NAME)?.value;
  if (!raw) return fail("missing_login_state");

  // Only a cookie WE signed is trusted: a forged or edited one (cookie injection
  // from a sibling subdomain or over plain HTTP) is rejected before anything else.
  const tmp = readLoginState(raw);
  if (!tmp) return fail("bad_login_state");

  // State first, before anything else is trusted.
  if (!sp.get("state") || sp.get("state") !== tmp.state) return fail("state_mismatch");
  if (sp.get("error")) return fail(sp.get("error")!); // e.g. access_denied
  const code = sp.get("code");
  if (!code) return fail("missing_code");

  try {
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri, // must equal the value sent in /authorize
      code_verifier: tmp.verifier,
    });
    if (!tokens.id_token) return fail("no_id_token");

    const claims = await verifyIdToken(tokens.id_token, tmp.nonce);
    const now = Math.floor(Date.now() / 1000);

    // A brand new session id at every login.
    const sessionId = await getSessionStore().create({
      sub: String(claims.sub),
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      sid: claims.sid as string | undefined,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessExp: now + (tokens.expires_in ?? 300),
      createdAt: now,
    });

    // returnTo is checked again here, not only at login: the redirect target must
    // never be an off-site URL, whatever the cookie says.
    const res = NextResponse.redirect(
      new URL(safeReturnTo(tmp.returnTo), cfg.appBaseUrl),
      302,
    );
    res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: cfg.cookieSecure,
      sameSite: "lax",
      path: "/", // no Domain attribute: host-only
      maxAge: cfg.sessionTtl,
    });
    res.cookies.set(TMP_COOKIE_NAME, "", { path: "/auth", maxAge: 0 }); // single use
    return res;
  } catch {
    return fail("token_exchange_failed");
  }
}
