import { NextRequest, NextResponse } from "next/server";
import { createLogger, getTraceContext } from "otel";

import { apiBaseUrl } from "@/lib/session";

const logger = createLogger("frontend/otel-demo");

export type OtelDemoResponse = {
  success: boolean;
  items?: { id: number; label: string }[];
  traceId?: string;
  error?: string;
};

// One route serves both call patterns, so they're directly comparable in
// Jaeger:
//   SSR: app/[locale]/otel-demo/page.tsx (server component) -> here
//   CSR: otel-demo-client.tsx (browser)                     -> here
// Neither caller does anything OTel-specific beyond sending a `traceparent`
// header (see otel/trace-context's generateTraceparent) — the auto-
// instrumentation in both instrumentation.ts (this app) and apps/api's own
// instrumentation.ts extracts and continues that trace automatically, so
// getTraceContext().traceId below is exactly the trace-id the caller chose.
//
// The `source` query param is the ONLY thing that differs between the two
// callers' requests — it exists purely so the log lines below (and the
// span's own URL/http.target tag in Jaeger) say which path triggered this
// particular call, since otherwise this shared route's own logs read
// identically for both.
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const traceId = getTraceContext()?.traceId;
  const source = request.nextUrl.searchParams.get("source") ?? "unknown";

  logger.info(`GET /api/otel-demo called (source: ${source})`, {
    source,
    userAgent: request.headers.get("user-agent"),
  });

  try {
    const apiResponse = await fetch(`${apiBaseUrl()}/demo/items`, {
      cache: "no-store",
    });
    const data = (await apiResponse.json()) as { items: OtelDemoResponse["items"] };
    const duration = Date.now() - startTime;

    logger.info(`GET /api/otel-demo succeeded (source: ${source})`, {
      source,
      count: data.items?.length ?? 0,
      duration: `${duration}ms`,
    });

    const body: OtelDemoResponse = { success: true, items: data.items, traceId };
    return NextResponse.json(body, {
      headers: traceId ? { "x-trace-id": traceId } : undefined,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error(
      `GET /api/otel-demo failed (source: ${source})`,
      {
        source,
        duration: `${duration}ms`,
      },
      err,
    );

    const body: OtelDemoResponse = {
      success: false,
      traceId,
      error: err instanceof Error ? err.message : String(err),
    };
    return NextResponse.json(body, {
      status: 502,
      headers: traceId ? { "x-trace-id": traceId } : undefined,
    });
  }
}
