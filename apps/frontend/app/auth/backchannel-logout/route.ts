import { NextRequest, NextResponse } from "next/server";

import { verifyLogoutToken } from "@/lib/oidc/oidc";
import { getSessionStore } from "@/lib/oidc/session-store";

// OIDC Back-Channel Logout: the vendor POSTs a signed logout_token here when
// the user logs out elsewhere (or an admin ends the session). We verify it and
// delete every matching session, so the user is logged out here as well.
export async function POST(req: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const logoutToken = (await req.formData()).get("logout_token");
    if (typeof logoutToken !== "string") {
      return NextResponse.json(
        { error: "missing_logout_token" },
        { status: 400, headers: noStore },
      );
    }
    const { sid, sub } = await verifyLogoutToken(logoutToken);
    const store = getSessionStore();
    if (sid) await store.deleteByVendorSid(sid);
    else if (sub) await store.deleteBySub(sub);
    return new NextResponse(null, { status: 200, headers: noStore });
  } catch {
    return NextResponse.json(
      { error: "invalid_logout_token" },
      { status: 400, headers: noStore },
    );
  }
}
