import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSharedEnvIntoProcessEnv } from "../src/prismic/config.js";

/**
 * Local demo adaptation of the real project's seed-prismic-content.ts
 * (see ./seed-prismic-content.ts for the verbatim baseline copy) — NOT
 * the same script. The real one is hardcoded to apps/top-app/apps/ibe-app
 * message folders and a `@repo/cms/prismic` package alias, neither of
 * which exist here.
 *
 * This version reads THIS repo's apps/frontend/messages/en.json (the
 * same source generate-prismic-models-demo.ts already turned into the
 * customtypes/<id>/index.json models under packages/cms/customtypes/)
 * and creates or updates one singleton document per namespace in the
 * real next-js-ssr repository — every field is a plain Text value taken
 * directly from the message string.
 *
 * Defaults to a dry run (prints what it WOULD do); pass --write to
 * actually create/update documents.
 */

type SeedOperation = {
  action: "create" | "update";
  modelId: string;
  title: string;
  fieldCount: number;
};

type ExistingDocument = {
  id: string;
  uid?: string | null;
  type: string;
  lang: string;
  tags: string[];
  data: Record<string, unknown>;
};

type PrismicCustomTypeModel = {
  id: string;
  json: Record<string, Record<string, { type: string; config: { label: string } }>>;
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const messagesPath = path.resolve(
  scriptDirectory,
  "../../../apps/frontend/messages/en.json",
);
const customTypesRoot = path.resolve(scriptDirectory, "../customtypes");

const shouldWrite = process.argv.includes("--write");
const prismicLocale = "en-us";

loadSharedEnvIntoProcessEnv();

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});

async function main() {
  const messages = JSON.parse(readFileSync(messagesPath, "utf8")) as Record<
    string,
    unknown
  >;
  const [{ createPrismicClient }, { createPrismicMigration, createPrismicWriteClient }] =
    await Promise.all([
      import("../src/prismic/create-client.js"),
      import("../src/prismic/write-client.js"),
    ]);

  const migration = createPrismicMigration();
  const readClient = createPrismicClient();
  const operations: SeedOperation[] = [];

  for (const [namespace, fields] of Object.entries(messages)) {
    if (!isPlainObject(fields)) {
      continue;
    }

    const model = loadCustomTypeModel(namespace);
    if (!model) {
      console.warn(
        `Skipping "${namespace}" — no customtypes/${toModelId(namespace)}/index.json found. Run prismic-model-generate first.`,
      );
      continue;
    }

    const modelId = model.id;
    const title = toReadableLabel(namespace);
    const data = buildDocumentData(model, fields);

    // Checked in both dry-run and --write mode — read-only, so it's safe
    // to always do, and it's the only way the dry-run preview can report
    // an accurate create-vs-update action instead of guessing.
    const existingDocument = await findExistingSingleton(readClient, modelId);
    operations.push({
      action: existingDocument ? "update" : "create",
      modelId,
      title,
      fieldCount: Object.keys(data).length,
    });

    if (!shouldWrite) {
      continue;
    }

    if (existingDocument) {
      migration.updateDocument({ ...existingDocument, data }, title);
    } else {
      migration.createDocument(
        { type: modelId, lang: prismicLocale, tags: [], data },
        title,
      );
    }
  }

  console.log(
    `${shouldWrite ? "Seeding" : "[dry run] Would seed"} ${operations.length} document(s):\n` +
      operations
        .map(
          (op) =>
            `  ${op.action} ${op.modelId} — "${op.title}" (${op.fieldCount} field(s))`,
        )
        .join("\n"),
  );

  if (!shouldWrite) {
    console.log("\nRun again with --write to actually create/update these documents.");
    return;
  }

  const writeClient = createPrismicWriteClient();
  await writeClient.migrate(migration, {
    reporter: (event: { type: string }) =>
      console.log(`[prismic:migration] ${event.type}`),
  });
}

function buildDocumentData(
  model: PrismicCustomTypeModel,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const mainTab = model.json.Main ?? {};

  for (const fieldKey of Object.keys(mainTab)) {
    data[fieldKey] = String(fields[fieldKey] ?? "");
  }

  return data;
}

function loadCustomTypeModel(namespace: string): PrismicCustomTypeModel | undefined {
  const modelPath = path.join(customTypesRoot, toModelId(namespace), "index.json");

  if (!existsSync(modelPath)) {
    return undefined;
  }

  try {
    const model = JSON.parse(readFileSync(modelPath, "utf8")) as PrismicCustomTypeModel;
    return model?.json ? model : undefined;
  } catch {
    return undefined;
  }
}

async function findExistingSingleton(
  client: { getSingle: (type: string, options: { lang: string }) => Promise<unknown> },
  modelId: string,
): Promise<ExistingDocument | undefined> {
  try {
    return (await client.getSingle(modelId, { lang: prismicLocale })) as ExistingDocument;
  } catch (error) {
    if (isPrismicNotFoundError(error)) {
      return undefined;
    }
    throw new Error(
      `Failed to look up existing Prismic document for type "${modelId}".`,
      {
        cause: error,
      },
    );
  }
}

function isPrismicNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  if (error instanceof Error && error.message.includes("No documents were returned")) {
    return true;
  }
  const errorWithStatus = error as { status?: number; response?: { status?: number } };
  return errorWithStatus.status === 404 || errorWithStatus.response?.status === 404;
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const details = [error.message];
  if (error.cause) {
    details.push(`cause=${formatUnknown(error.cause)}`);
  }
  if (error.stack) {
    details.push(error.stack);
  }
  return details.join("\n");
}

function formatUnknown(value: unknown): string {
  if (value instanceof Error) {
    return [value.message, value.stack].filter(Boolean).join("\n");
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toModelId(namespace: string): string {
  return namespace
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function toReadableLabel(value: string): string {
  return toModelId(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
