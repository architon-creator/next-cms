// Streams one `promote` hop's log lines to the browser as Server-Sent
// Events, so the UI shows progress live instead of a spinner until the
// whole hop finishes (a hop runs preflight + assets + migrate in
// sequence, which can take a while against a real content library). GET
// + query params rather than POST + a streamed request body, specifically
// so the client can use the browser's built-in EventSource, which only
// speaks GET — see app/migrations/MigrationsClient.tsx.
//
// TODO before this is real: there is NO auth check in this file. Anyone
// who can reach this route can trigger a real write to a real Prismic
// environment. Wire whatever admin-app's own access control ends up
// being around this route (and its sibling /api/migrations/confirm)
// before this ships anywhere reachable outside your own machine.
import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runPromoteHop } from "prismic-migration/actions";
import { runWithLogSink } from "prismic-migration/logger";
import { createRunLog } from "@/lib/run-log-store";

// Long-running + streamed — opts this route out of any static/edge
// optimization that would buffer or cache the response.
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs Node APIs (fs, the Prismic HTTP client) — not Edge-compatible

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dryRun = searchParams.get("dryRun") === "true";
  const onlyParam = searchParams.get("only");
  const onlyLowerIds = onlyParam
    ? onlyParam.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;
  const onlyLang = searchParams.get("lang") || undefined;

  if (!from || !to) {
    return new Response("from and to query params are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const runLog = await createRunLog("promote", from, to);
      send("meta", { runLogFilename: runLog.filename });

      // Each line prismic-migration's log() produces is already a
      // serialized `{ ts, level, event, ...fields }` JSON string —
      // re-parsed here only so the client receives a structured `data:`
      // payload rather than a JSON-string-inside-a-JSON-string. Persisted
      // to runLog verbatim (already the exact JSON-lines shape
      // public/log-viewer.html expects) so this run survives the browser
      // tab closing.
      const sink = (line: string) => {
        send("log", JSON.parse(line));
        void runLog.appendLine(line);
      };

      try {
        const config = loadConfig();
        const result = await runWithLogSink(sink, () =>
          runPromoteHop(config, from, to, dryRun, onlyLowerIds, onlyLang),
        );
        send("done", result);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // Browser navigated away / closed the EventSource — stop caring
      // about further send() calls; the in-flight migration itself still
      // runs to completion server-side (there's no cheap way to abort
      // Prismic API calls already in flight, and half-applying a
      // migration is worse than letting it finish unobserved).
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
