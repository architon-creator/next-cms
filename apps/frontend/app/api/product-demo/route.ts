import { NextRequest, NextResponse } from "next/server";

import { apiUnreachable, productApiBaseUrl } from "@/lib/product-demo-api";

// Forwards the browser's multipart/form-data to the API. Re-sending the
// parsed FormData (rather than the raw body stream) lets fetch generate a
// fresh Content-Type with the correct boundary — never set that header by
// hand for multipart requests. Updates go through [id]/route.ts.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiResponse = await fetch(`${productApiBaseUrl()}/demo/products`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    const data: unknown = await apiResponse.json();
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (err) {
    return apiUnreachable(err);
  }
}
