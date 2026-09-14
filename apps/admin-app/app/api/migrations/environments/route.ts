import { loadConfig } from "prismic-migration/config";

// Lets the UI populate its from/to dropdowns from the actual configured
// ENVIRONMENT_CHAIN (see packages/prismic-migration/src/config.ts) instead
// of a hardcoded guess that could silently drift from real config.
export async function GET() {
  const config = loadConfig();
  return Response.json({
    chain: config.environmentChain,
    // Only environments with a `<NAME>_REPOSITORY` env var actually set —
    // lets the UI grey out an environment nobody's configured yet (e.g.
    // PROD, before it exists) instead of letting you pick it and fail.
    configured: Object.keys(config.environments),
  });
}
