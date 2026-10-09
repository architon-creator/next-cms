import { NextResponse } from "next/server";

import { currentSession } from "@/lib/oidc/auth";
import { missingOidcEnv } from "@/lib/oidc/config";

// What the header asks: "is the OIDC login on, and who is signed in?". It
// returns only display data, never a token or the session id. The header is a
// client island that calls this instead of reading cookies during render, which
// would make every page dynamic.
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  if (missingOidcEnv().length > 0) {
    // Login not configured here: the header falls back to the old sign-in.
    return NextResponse.json({ enabled: false, user: null }, { headers: noStore });
  }
  try {
    const cur = await currentSession();
    const user = cur
      ? {
          name: cur.s.name ?? cur.s.email ?? cur.s.sub,
          email: cur.s.email ?? null,
        }
      : null;
    return NextResponse.json({ enabled: true, user }, { headers: noStore });
  } catch {
    // The session store is down: report signed-out without clearing anything.
    return NextResponse.json(
      { enabled: true, user: null },
      { status: 503, headers: noStore },
    );
  }
}
