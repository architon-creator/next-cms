"use client";

import { useState } from "react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

// Calls the secured Java endpoint through the Next proxy. The browser sends
// only its session cookie; the proxy adds the bearer token.
export function AccountClient() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function callJava() {
    setLoading(true);
    try {
      const response = await fetch("/api/ibe/bookings/me");
      const body = await response.text();
      setResult(`${response.status}\n${body}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Call the secured Java API</CardTitle>
          <CardDescription>
            <code>GET /api/ibe/bookings/me</code> is forwarded to Java with your access
            token.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={callJava}
            disabled={loading}
            className="self-start"
          >
            {loading ? "Calling…" : "Call /api/bookings/me"}
          </Button>
          {result && (
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 text-xs">
              {result}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* A form POST, not a link: logging out must not be triggerable by another site. */}
      <form action="/auth/logout" method="post">
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </>
  );
}
