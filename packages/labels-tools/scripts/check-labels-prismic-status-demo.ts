import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSharedEnvIntoProcessEnv } from "../src/prismic/config.js";

/**
 * Read-only companion to seed-prismic-content-demo.ts: for each namespace
 * that already has a customtypes/<id>/index.json model, looks up whether
 * its singleton document already exists in the real next-js-ssr repository
 * — the same findExistingSingleton() check the seed script does before
 * deciding create-vs-update — WITHOUT writing anything.
 *
 * Exists because the admin-app Labels UI's Step 2 (Seed) picker used to
 * base its "already up to date" / disabled state purely on the en.json ↔
 * local-model-file diff (see /api/labels/namespaces), which only tells you
 * whether Step 1 (Generate) has anything left to do. It says nothing about
 * whether a namespace's content has ever actually been seeded into
 * Prismic — a namespace can be perfectly "up to date" schema-wise and
 * still have no document in Prismic at all. Step 2 needs its own signal
 * for that, which only a live Prismic lookup can answer.
 *
 * Prints one JSON object to stdout — {"Header": "existing", "Footer":
 * "new", ...} — keyed by namespace, so the admin-app API route spawning
 * this can parse a single line rather than line-buffered progress output.
 */

type PrismicStatus = "no-model" | "new" | "existing" | "error";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const messagesPath = path.resolve(scriptDirectory, "../../../apps/frontend/messages/en.json");
const customTypesRoot = path.resolve(scriptDirectory, "../customtypes");
const prismicLocale = "en-us";

loadSharedEnvIntoProcessEnv();

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});

async function main() {
  const messages = JSON.parse(readFileSync(messagesPath, "utf8")) as Record<string, unknown>;
  const { createPrismicClient } = await import("../src/prismic/create-client.js");
  const readClient = createPrismicClient();

  const statuses: Record<string, PrismicStatus> = {};

  for (const [namespace, fields] of Object.entries(messages)) {
    if (!isPlainObject(fields)) continue;

    const modelId = toModelId(namespace);
    if (!existsSync(path.join(customTypesRoot, modelId, "index.json"))) {
      statuses[namespace] = "no-model";
      continue;
    }

    try {
      const exists = await findExistingSingleton(readClient, modelId);
      statuses[namespace] = exists ? "existing" : "new";
    } catch {
      statuses[namespace] = "error";
    }
  }

  console.log(JSON.stringify(statuses));
}

async function findExistingSingleton(
  client: { getSingle: (type: string, options: { lang: string }) => Promise<unknown> },
  modelId: string,
): Promise<boolean> {
  try {
    await client.getSingle(modelId, { lang: prismicLocale });
    return true;
  } catch (error) {
    if (isPrismicNotFoundError(error)) return false;
    throw error;
  }
}

function isPrismicNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (error instanceof Error && error.message.includes("No documents were returned")) return true;
  const errorWithStatus = error as { status?: number; response?: { status?: number } };
  return errorWithStatus.status === 404 || errorWithStatus.response?.status === 404;
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return [error.message, error.stack].filter(Boolean).join("\n");
}

function toModelId(namespace: string): string {
  return namespace
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
