import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Runs on every path except API routes, Next internals, and anything
  // that looks like a static file (has a dot in its last segment, e.g.
  // favicon.ico) — those must never get a locale prefix rewritten onto them.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
