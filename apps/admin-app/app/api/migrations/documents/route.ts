import type { NextRequest } from "next/server";
import { loadConfig } from "prismic-migration/config";
import { listLowerDocuments } from "prismic-migration/actions";

// Backs the optional document picker on /migrations — lets someone
// narrow a promote hop to specific documents (via runPromoteHop's
// onlyLowerIds) instead of always migrating the whole content library.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return new Response("from and to query params are required", { status: 400 });
  }

  try {
    const config = loadConfig();
    const documents = await listLowerDocuments(config, from, to);
    return Response.json({ documents });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
