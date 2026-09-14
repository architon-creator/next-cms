// Same streaming shape as ../promote/route.ts. Takes a PAST run's saved
// log filename (from /history) rather than from/to + dryRun — rollback
// needs to know exactly what that specific hop did (which documents it
// created vs updated, and where its pre-hop snapshot landed), which only
// that run's own log records. See lib/run-log-store.ts's
// buildRollbackPlanFromLog and prismic-migration/actions.ts's
// runRollback for what this can and can't actually undo (no delete
// endpoint on Prismic's Migration API — creates can only be listed for
// manual deletion, not undone here).
//
// Same TODO as the other routes: no auth check here yet. This one writes
// to Prismic too (PUT, reverting updated documents) — same stakes as
// promote.
import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { runRollback } from "prismic-migration/actions";
import { runWithLogSink } from "prismic-migration/logger";
import { buildRollbackPlanFromLog, createRunLog } from "@/lib/run-log-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const runLogFilename = searchParams.get("runLogFilename");

  if (!from || !to || !runLogFilename) {
    return new Response("from, to, and runLogFilename query params are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const runLog = await createRunLog("rollback", from, to);
      send("meta", { runLogFilename: runLog.filename });
      const sink = (line: string) => {
        send("log", JSON.parse(line));
        void runLog.appendLine(line);
      };

      try {
        const plan = await buildRollbackPlanFromLog(runLogFilename);
        if (!plan.upperSnapshotPath) {
          throw new Error(
            "That run's log has no phase0.snapshots_taken event — can't find its pre-hop snapshot to revert to.",
          );
        }
        if (plan.updated.length === 0 && plan.created.length === 0) {
          send("log", {
            ts: new Date().toISOString(),
            level: "info",
            event: "rollback.nothing_to_do",
            reason: "That run never created or updated anything for real (was it a dry run?).",
          });
          send("done", { reverted: [], needsManualDeletion: [] });
          return;
        }

        const config = loadConfig();
        const result = await runWithLogSink(sink, () =>
          runRollback({
            config,
            fromName: from,
            toName: to,
            upperSnapshotPath: plan.upperSnapshotPath!,
            updated: plan.updated,
            created: plan.created,
          }),
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
