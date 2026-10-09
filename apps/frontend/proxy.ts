import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// Pages that need an OIDC login (the optional /<locale> prefix included).
// This is only a cheap gate: it checks that the session cookie EXISTS. The real
// check (session store lookup) happens in the page itself via currentSession(),
// so a forged cookie gets past here but not past the page.
const PROTECTED = new RegExp(`^(?:/(?:${routing.locales.join("|")}))?/account(?:/|$)`);
const SESSION_COOKIE = "ibe_session";

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PROTECTED.test(pathname) && !req.cookies.get(SESSION_COOKIE)) {
    // Build the URL from the configured public base, not from req.url (the
    // internal host behind a load balancer).
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    const login = new URL("/auth/login", base);
    login.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(login);
  }

  return intl(req);
}

export const config = {
  // Runs on every path except API routes, the OIDC routes (/auth/*, which are
  // not locale pages), Next internals, and anything that looks like a static
  // file (has a dot in its last segment, e.g. favicon.ico) — those must never
  // get a locale prefix rewritten onto them.
  matcher: ["/((?!api|auth/|_next|_vercel|.*\\..*).*)"],
};
