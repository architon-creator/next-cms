import { createLogger } from "otel";
import { generateTraceparent } from "otel/trace-context";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import { getSiteUrl } from "@/lib/site-url";

import { OtelDemoClient } from "./otel-demo-client";
import type { OtelDemoResponse } from "@/app/api/otel-demo/route";

const logger = createLogger("frontend/pages/otel-demo");

// SSR half of the demo: this page (a Server Component) generates its own
// traceparent and calls /api/otel-demo over a real HTTP request during
// render — a self-fetch, not a direct function call, specifically so this
// page is a genuine HTTP caller just like the CSR button below, making the
// two directly comparable in Jaeger. Server Components don't get an
// implicit base URL for self-fetches, hence getSiteUrl() rather than a
// relative path.
async function fetchItemsForSSR(): Promise<OtelDemoResponse> {
  const traceparent = generateTraceparent();

  logger.info("Rendering otel-demo page (SSR)");

  const res = await fetch(`${getSiteUrl()}/api/otel-demo?source=ssr`, {
    headers: { traceparent },
    cache: "no-store",
  });
  return (await res.json()) as OtelDemoResponse;
}

export default async function OtelDemoPage() {
  const data = await fetchItemsForSSR();

  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">OpenTelemetry SSR / CSR demo</h1>
        <p className="text-sm text-muted-foreground">
          Both sections below hit the same backend endpoint (apps/api&apos;s{" "}
          <code>/demo/items</code>) through the same frontend route (
          <code>/api/otel-demo</code>) — only how the request gets triggered differs.
          Compare the two <code>traceId</code> values in{" "}
          <a
            className="underline"
            href="http://localhost:16686"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jaeger
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SSR demo</CardTitle>
          <CardDescription>
            Page render (server component) → generates its own traceparent →
            /api/otel-demo → backend. Reload this page for a fresh trace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            traceId: <code>{data.traceId ?? "n/a"}</code>
          </p>
          {data.success ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {data.items?.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-destructive">Request failed: {data.error}</p>
          )}
        </CardContent>
      </Card>

      <OtelDemoClient />
    </div>
  );
}
