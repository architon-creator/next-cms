import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSharedEnvIntoProcessEnv } from "../src/prismic/config.js";

/**
 * Read-only drift report combining what admin-app's /labels UI already
 * shows interactively (see /api/labels/namespaces and
 * /api/labels/prismic-status) into one Markdown summary a scheduled CI
 * job can post without anyone opening that page. Two independent kinds
 * of drift, both worth surfacing on their own cadence rather than only
 * when someone happens to load the UI:
 *
 *  - SCHEMA drift: en.json has fields a local customtypes/<id>/index.json
 *    doesn't (or vice versa) — Generate has something to do.
 *  - CONTENT drift: a namespace has a local model but no singleton
 *    document in Prismic yet — Seed has never actually run for it.
 *
 * Deliberately duplicates toModelId()/diff logic already living in
 * generate-prismic-models-demo.ts, seed-prismic-content-demo.ts,
 * check-labels-prismic-status-demo.ts, and the admin-app namespaces
 * route, matching this repo's existing convention of each of these demo
 * scripts staying self-contained rather than sharing a module — see
 * those files' own comments for why.
 *
 * Always exits 0 — this reports drift, it doesn't gate on it (see
 * .github/workflows/labels-drift.yml for how it's scheduled).
 */

type SchemaStatus = "new" | "changed" | "up-to-date";
type PrismicStatus = "no-model" | "new" | "existing" | "error";

type NamespaceRow = {
  namespace: string;
  fieldCount: number;
  schemaStatus: SchemaStatus;
  addedKeys: string[];
  removedKeys: string[];
  prismicStatus: PrismicStatus;
};

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
  const entries = Object.entries(messages).filter(([, fields]) => isPlainObject(fields)) as [
    string,
    Record<string, unknown>,
  ][];

  const { createPrismicClient } = await import("../src/prismic/create-client.js");
  const readClient = createPrismicClient();

  const rows: NamespaceRow[] = [];
  for (const [namespace, fields] of entries) {
    const modelId = toModelId(namespace);
    const schemaDiff = diffSchema(modelId, fields);

    let prismicStatus: PrismicStatus;
    if (schemaDiff.status === "new" && !existsSync(path.join(customTypesRoot, modelId, "index.json"))) {
      prismicStatus = "no-model";
    } else {
      try {
        const exists = await findExistingSingleton(readClient, modelId);
        prismicStatus = exists ? "existing" : "new";
      } catch {
        prismicStatus = "error";
      }
    }

    rows.push({
      namespace,
      fieldCount: Object.keys(fields).length,
      schemaStatus: schemaDiff.status,
      addedKeys: schemaDiff.addedKeys,
      removedKeys: schemaDiff.removedKeys,
      prismicStatus,
    });
  }

  console.log(renderReport(rows));
}

function renderReport(rows: NamespaceRow[]): string {
  const needsGenerate = rows.filter((r) => r.schemaStatus !== "up-to-date");
  const needsPush = rows.filter((r) => r.prismicStatus === "no-model");
  const needsSeed = rows.filter((r) => r.prismicStatus === "new");
  const errored = rows.filter((r) => r.prismicStatus === "error");
  const settled = rows.filter(
    (r) => r.schemaStatus === "up-to-date" && r.prismicStatus === "existing",
  );

  const lines: string[] = [];
  lines.push("# Labels drift report");
  lines.push("");
  lines.push(
    `${rows.length} namespace(s) in en.json — ${settled.length} fully in sync, ` +
      `${needsGenerate.length} need Generate, ${needsPush.length} need a schema push to Prismic, ` +
      `${needsSeed.length} have a pushed schema but no document seeded yet` +
      (errored.length > 0 ? `, ${errored.length} couldn't be checked` : "") +
      ".",
  );

  if (needsGenerate.length > 0) {
    lines.push("", "## Needs Generate (en.json ↔ local schema mismatch)");
    for (const r of needsGenerate) {
      const detail =
        r.schemaStatus === "new"
          ? "no local model file yet"
          : `${r.addedKeys.length > 0 ? `+${r.addedKeys.length} key` : ""}${
              r.addedKeys.length > 0 && r.removedKeys.length > 0 ? ", " : ""
            }${r.removedKeys.length > 0 ? `-${r.removedKeys.length} key` : ""}`;
      lines.push(`- **${r.namespace}** (${r.fieldCount} field(s)) — ${detail}`);
    }
  }

  if (needsPush.length > 0) {
    lines.push("", "## Needs a schema push to Prismic (local model exists, Prismic doesn't know it)");
    for (const r of needsPush) {
      lines.push(`- **${r.namespace}** — run \`npx prismic push\` after \`npx prismic login\``);
    }
  }

  if (needsSeed.length > 0) {
    lines.push("", "## Needs Seed (pushed to Prismic, no document yet)");
    for (const r of needsSeed) {
      lines.push(`- **${r.namespace}**`);
    }
  }

  if (errored.length > 0) {
    lines.push("", "## Couldn't check Prismic status");
    for (const r of errored) {
      lines.push(`- **${r.namespace}**`);
    }
  }

  if (needsGenerate.length === 0 && needsPush.length === 0 && needsSeed.length === 0 && errored.length === 0) {
    lines.push("", "Everything is generated, pushed, and seeded. Nothing to do.");
  }

  return lines.join("\n");
}

type SchemaDiff = { status: SchemaStatus; addedKeys: string[]; removedKeys: string[] };

function diffSchema(modelId: string, fields: Record<string, unknown>): SchemaDiff {
  const modelPath = path.join(customTypesRoot, modelId, "index.json");
  let existingKeys: string[];
  try {
    const raw = readFileSync(modelPath, "utf8");
    const model = JSON.parse(raw) as { json?: { Main?: Record<string, unknown> } };
    const mainTab = model.json?.Main;
    if (!mainTab) return { status: "new", addedKeys: [], removedKeys: [] };
    existingKeys = Object.keys(mainTab);
  } catch {
    return { status: "new", addedKeys: [], removedKeys: [] };
  }

  const currentKeys = Object.keys(fields);
  const addedKeys = currentKeys.filter((key) => !existingKeys.includes(key));
  const removedKeys = existingKeys.filter((key) => !currentKeys.includes(key));

  if (addedKeys.length === 0 && removedKeys.length === 0) {
    return { status: "up-to-date", addedKeys: [], removedKeys: [] };
  }
  return { status: "changed", addedKeys, removedKeys };
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
