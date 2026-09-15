// Same streaming shape as ../promote/route.ts. Forward-only (--from
// must be the lower environment), enforced by runReconcileAction
// itself via requireDirection.
//
// Same TODO as the other write routes: no auth check here yet.
import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runReconcileAction } from "prismic-migration/actions";
import { runWithLogSink } from "prismic-migration/logger";
import { formatMigrationError } from "@/lib/migration-errors";
import { createRunLog } from "@/lib/run-log-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dryRun = searchParams.get("dryRun") === "true";

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

      const runLog = await createRunLog("reconcile", from, to);
      send("meta", { runLogFilename: runLog.filename });
      const sink = (line: string) => {
        send("log", JSON.parse(line));
        void runLog.appendLine(line);
      };

      try {
        const config = loadConfig();
        const result = await runWithLogSink(sink, () =>
          runReconcileAction(config, from, to, dryRun),
        );
        send("done", result);
      } catch (err) {
        send("error", formatMigrationError(err));
      } finally {
        closed = true;
        controller.close();
      }
    },
    cancel() {
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
