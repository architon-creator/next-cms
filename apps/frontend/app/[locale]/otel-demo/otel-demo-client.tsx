"use client";

import { useState } from "react";
import { generateTraceparent } from "otel/trace-context";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import type { OtelDemoResponse } from "@/app/api/otel-demo/route";

// Runs in the browser. Imports ONLY the dependency-free trace-context
// helper (via its direct subpath) — never "otel"'s main entry, which pulls
// in Node's async_hooks and @vercel/otel and would break in a browser
// bundle. See packages/otel/src/trace-context.ts's own header comment.
export function OtelDemoClient() {
  const [result, setResult] = useState<OtelDemoResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    // Generated here, in the browser, before the fetch — this is the whole
    // mechanism: the server's auto-instrumentation extracts this header on
    // arrival and adopts its trace-id as the request's own, no custom
    // correlation-id code needed on either end.
    const traceparent = generateTraceparent();

    const response = await fetch("/api/otel-demo?source=csr", {
      headers: { traceparent },
    });
    const data = (await response.json()) as OtelDemoResponse;
    setResult(data);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSR demo</CardTitle>
        <CardDescription>
          Browser click → generates its own traceparent → /api/otel-demo → backend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={handleClick} disabled={loading}>
          {loading ? "Fetching…" : "Fetch items (CSR)"}
        </Button>

        {result && (
          <div className="mt-4">
            <p className="text-sm">
              traceId: <code>{result.traceId ?? "n/a"}</code>
            </p>
            {result.success ? (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {result.items?.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-destructive">
                Request failed: {result.error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
