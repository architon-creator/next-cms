import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/session";

// Which backend serves /demo/products. Defaults to the Express API (API_URL);
// set PRODUCT_API_URL=http://localhost:4001 to use the Java implementation in
// apps/java-api instead. Same endpoints, same payload.
export const productApiBaseUrl = () => process.env.PRODUCT_API_URL || apiBaseUrl();

// Node's fetch only says "fetch failed" when the connection is refused; say
// what actually went wrong so it is obvious the API is not running.
export function apiUnreachable(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    {
      success: false,
      error: `Cannot reach the API at ${productApiBaseUrl()} (${detail}). Is it running? Start it with "pnpm api:dev" (Express) or "pnpm java:dev" (Java).`,
    },
    { status: 502 },
  );
}
