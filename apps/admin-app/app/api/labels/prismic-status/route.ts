import path from "node:path";
import { isLabelsToolEnabled } from "@/lib/labels-guard";
import { spawnAndCapture } from "@/lib/spawn-log";

// Read-only lookup: for each namespace with a local customtypes/ model,
// asks Prismic (via check-labels-prismic-status-demo.ts) whether its
// singleton document already exists there. Separate from
// /api/labels/namespaces, which only diffs en.json against the local
// model file and can't say anything about what's actually live in
// Prismic — see that script's own comment for why Step 2 (Seed) needs
// this instead of reusing Step 1's status.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cmsDir = path.resolve(process.cwd(), "../../packages/cms");

export type PrismicNamespaceStatus = "no-model" | "new" | "existing" | "error";

export async function GET() {
  if (!isLabelsToolEnabled()) {
    return new Response("The labels tool is disabled in this environment.", { status: 403 });
  }

  try {
    const { exitCode, stdout, stderr } = await spawnAndCapture(
      "pnpm",
      ["run", "prismic-labels-status"],
      cmsDir,
    );
    if (exitCode !== 0) {
      return new Response(stderr || `prismic-labels-status exited with code ${exitCode}`, {
        status: 500,
      });
    }

    // The script's only stdout line is its JSON result, but pnpm itself
    // can print its own banner lines around it — take the last line that
    // parses as JSON rather than assuming stdout is exactly one line.
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const statuses = JSON.parse(lines[i]) as Record<string, PrismicNamespaceStatus>;
        return Response.json({ statuses });
      } catch {
        continue;
      }
    }
    return new Response("Could not parse prismic-labels-status output.", { status: 500 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
