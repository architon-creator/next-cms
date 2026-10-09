import { NextRequest, NextResponse } from "next/server";

import { currentSession, validAccessToken } from "@/lib/oidc/auth";
import { oidcConfig } from "@/lib/oidc/config";

// The only way the browser reaches the Java API: /api/ibe/<path> here ->
// <JAVA_API_BASE_URL>/api/<path>. The session cookie authenticates the browser
// to THIS app; the access token is looked up server side and added as a
// bearer token. The browser never sees a token and never calls Java directly,
// so there is no CORS and Java can sit in a private subnet.
type Context = { params: Promise<{ path: string[] }> };

const isRead = (method: string) => method === "GET" || method === "HEAD";

async function handler(req: NextRequest, ctx: Context) {
  const cfg = oidcConfig();

  // CSRF defence in depth for cookie-authenticated writes (SameSite=Lax is the first layer).
  if (!isRead(req.method)) {
    const origin = req.headers.get("origin");
    let sameOrigin = false;
    try {
      sameOrigin =
        origin !== null && new URL(origin).origin === new URL(cfg.appBaseUrl).origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const cur = await currentSession();
  const token = cur ? await validAccessToken(cur.id, cur.s) : null;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { path } = await ctx.params;
  let upstream: Response;
  try {
    upstream = await fetch(
      `${cfg.javaBase}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": req.headers.get("content-type") ?? "application/json",
        },
        // Text bodies only (JSON). Multipart uploads are not proxied here.
        body: isRead(req.method) ? undefined : await req.text(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
