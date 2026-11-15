import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PrismicLabelSource = {
  id: "top-app" | "ibe-app";
  messagesDirectory: string;
  parentDocumentType: string;
};

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

const labelSources: Record<PrismicLabelSource["id"], PrismicLabelSource> = {
  "top-app": {
    id: "top-app",
    messagesDirectory: path.resolve(scriptsDirectory, "../../../apps/top-app/messages"),
    // Keep the currently published parent until its Prismic migration is planned.
    parentDocumentType: "ibe",
  },
  "ibe-app": {
    id: "ibe-app",
    messagesDirectory: path.resolve(scriptsDirectory, "../../../apps/ibe-app/messages"),
    parentDocumentType: "ibe",
  },
};

console.log("TOP APP PATH", labelSources["top-app"].messagesDirectory);
console.log("IBE APP PATH", labelSources["ibe-app"].messagesDirectory);

/**
 * Resolves one application's JSON label source for Prismic tooling.
 */
export function getPrismicLabelSource(sourceId = "top-app"): PrismicLabelSource {
  const source = labelSources[sourceId as PrismicLabelSource["id"]];

  if (!source) {
    throw new Error(
      `Unknown Prismic label source "${sourceId}". Available sources: ${Object.keys(labelSources).join(", ")}`,
    );
  }

  return source;
}

/**
 * Every registered label source, regardless of which one a given CLI
 * invocation targets via --source. Needed wherever a shared parent
 * document type (e.g. "ibe") is being generated or written: that
 * document's fields must reflect every source that links into it, not
 * just whichever one is currently selected -- generating or writing it
 * from a single source's documents would silently drop every other
 * source's already-published fields/links the next time it runs.
 */
export function getAllPrismicLabelSources(): PrismicLabelSource[] {
  return Object.values(labelSources);
}

/**
 * Loads a locale's plain JSON labels without importing application code.
 */
export function loadPrismicLabelMessages(
  source: PrismicLabelSource,
  locale: string,
): Record<string, unknown> {
  const messagesPath = path.join(source.messagesDirectory, `${locale}.json`);

  if (!existsSync(messagesPath)) {
    throw new Error(
      `Missing ${source.id} Prismic label input for locale "${locale}": ${messagesPath}`,
    );
  }

  const messages = JSON.parse(readFileSync(messagesPath, "utf8")) as unknown;

  if (!isRecord(messages)) {
    throw new Error(
      `Invalid ${source.id} Prismic label input for locale "${locale}". Expected a JSON object.`,
    );
  }

  return messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
