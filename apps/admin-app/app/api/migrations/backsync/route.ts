// Same streaming shape as ../promote/route.ts. Direction is the
// opposite of promote: --from must be the UPPER environment (backward),
// enforced by runBacksyncAction itself via requireDirection — this
// route doesn't need to know which direction is which, the same
// from/to fields on /migrations work for both, and a wrong-direction
// pair fails with a clear error rather than silently doing nothing.
//
// Same TODO as the other routes: no auth check here yet. This one
// writes to Prismic too (ongoing upper -> lower sync).
import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runBacksyncAction } from "prismic-migration/actions";
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

      const runLog = await createRunLog("backsync", from, to);
      send("meta", { runLogFilename: runLog.filename });
      const sink = (line: string) => {
        send("log", JSON.parse(line));
        void runLog.appendLine(line);
      };

      try {
        const config = loadConfig();
        const result = await runWithLogSink(sink, () =>
          runBacksyncAction(config, from, to, dryRun),
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
