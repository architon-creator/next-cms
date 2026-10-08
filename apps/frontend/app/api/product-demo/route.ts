import { NextRequest, NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/session";

// Forwards the browser's multipart/form-data to the Express API. Re-sending
// the parsed FormData (rather than the raw body stream) lets fetch generate a
// fresh Content-Type with the correct boundary — never set that header by
// hand for multipart requests.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiResponse = await fetch(`${apiBaseUrl()}/demo/products`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    const data: unknown = await apiResponse.json();
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
