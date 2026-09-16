import { readFile } from "node:fs/promises";
import path from "node:path";
import { isLabelsToolEnabled } from "@/lib/labels-guard";

// Cheap, safe, read-only — parses the same source file
// generate-prismic-models-demo.ts / seed-prismic-content-demo.ts consume,
// so the UI can list namespaces before running either script rather than
// requiring a run just to see what's there.
const messagesPath = path.resolve(process.cwd(), "../../apps/frontend/messages/en.json");
const customTypesRoot = path.resolve(process.cwd(), "../../packages/cms/customtypes");

export type NamespaceStatus = "new" | "changed" | "up-to-date";

export type NamespaceDiff = {
  namespace: string;
  fieldCount: number;
  status: NamespaceStatus;
  /** Field keys present in en.json but not in the existing model file — only set when status is "changed". */
  addedKeys: string[];
  /** Field keys present in the existing model file but no longer in en.json — only set when status is "changed". */
  removedKeys: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Same conversion generate-prismic-models-demo.ts/seed-prismic-content-demo.ts
// each already duplicate their own copy of — kept consistent so the model
// file this looks up is exactly the one those scripts would read/write.
function toModelId(namespace: string): string {
  return namespace
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * Compares a namespace's current en.json field KEYS against its existing
 * customtypes/<id>/index.json's field keys — not values, since the model
 * file only ever captured field structure (name + label), never the
 * actual translated string. A value-only edit (translating a string
 * differently, e.g.) has nothing to diff here and would only show up
 * once Seed re-reads en.json's live values — this is purely about
 * whether Generate has anything new to write.
 */
async function diffNamespace(
  namespace: string,
  fields: Record<string, unknown>,
): Promise<Pick<NamespaceDiff, "status" | "addedKeys" | "removedKeys">> {
  const modelPath = path.join(customTypesRoot, toModelId(namespace), "index.json");
  let existingKeys: string[];
  try {
    const raw = await readFile(modelPath, "utf8");
    const model = JSON.parse(raw) as { json?: { Main?: Record<string, unknown> } };
    const mainTab = model.json?.Main;
    if (!mainTab) return { status: "new", addedKeys: [], removedKeys: [] };
    existingKeys = Object.keys(mainTab);
  } catch {
    // No model file yet — nothing generated for this namespace at all.
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

export async function GET() {
  if (!isLabelsToolEnabled()) {
    return new Response("The labels tool is disabled in this environment.", { status: 403 });
  }

  try {
    const raw = await readFile(messagesPath, "utf8");
    const messages = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(messages).filter(([, fields]) => isPlainObject(fields)) as [
      string,
      Record<string, unknown>,
    ][];

    const namespaces: NamespaceDiff[] = await Promise.all(
      entries.map(async ([namespace, fields]) => {
        const diff = await diffNamespace(namespace, fields);
        return {
          namespace,
          fieldCount: Object.keys(fields).length,
          ...diff,
        };
      }),
    );

    return Response.json({ namespaces });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
