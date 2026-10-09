import { NextResponse } from "next/server";

import { currentSession } from "@/lib/oidc/auth";
import { oidcConfig, SESSION_COOKIE_NAME } from "@/lib/oidc/config";
import { discovery } from "@/lib/oidc/oidc";
import { getSessionStore } from "@/lib/oidc/session-store";

// POST only, so another site cannot log people out with an <img> tag. The
// session record is deleted (not just the cookie), then the vendor's session
// is ended if it supports RP-initiated logout.
export async function POST() {
  const cfg = oidcConfig();
  const cur = await currentSession();
  if (cur) await getSessionStore().delete(cur.id);

  let target = `${cfg.appBaseUrl}/`;
  if (cur) {
    try {
      const d = await discovery();
      if (d.end_session_endpoint) {
        const u = new URL(d.end_session_endpoint);
        u.searchParams.set("id_token_hint", cur.s.idToken);
        u.searchParams.set("post_logout_redirect_uri", `${cfg.appBaseUrl}/`);
        u.searchParams.set("client_id", cfg.clientId);
        target = u.toString();
      }
    } catch {
      // The vendor is unreachable: we are logged out locally, which is what matters here.
    }
  }

  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
