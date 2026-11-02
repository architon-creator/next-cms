import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSharedEnvIntoProcessEnv } from "../src/prismic/config.js";

/**
 * Standalone, page-wise locale migration: takes a customer-supplied
 * <locale>.json (same shape as apps/frontend/messages/en.json — one
 * top-level key per page/namespace) and writes it into Prismic as
 * translations of the existing English documents.
 *
 *   npx tsx scripts/migrate-locale-labels.ts --locale ja --file <ja.json>            # dry run
 *   npx tsx scripts/migrate-locale-labels.ts --locale ko --file <ko.json> --page HomePage,LoginPage --write
 *
 * Per page it finds the English (master) document, then creates the
 * translation (linked to it as an alternate language) or updates it if one
 * is already published. Finally it creates/updates the hub (app_labels) in
 * the target locale with links to the translated documents.
 *
 * Safety rules:
 *   - Dry run by default; nothing is written without --write.
 *   - The file is validated first (string values only, {placeholders} must
 *     match English). Any problem aborts the run with exit code 1 — a dry
 *     run exits 1 too, so it can be used as a CI check.
 *   - With --strict, a key missing from the file is an error instead of a warning.
 *   - Keys missing from the file fall back to the English text (reported);
 *     keys that are not in the Prismic model are ignored (reported).
 *   - The target locale must be enabled in the Prismic repository.
 *   - Written documents land in a Migration Release and are invisible to the
 *     read API until published. A local state file remembers what was
 *     written so a re-run cannot create duplicates; publish the release (or
 *     pass --force-create) before running again.
 */

/** CLI --locale value -> Prismic locale code. Edit here if a repo uses other codes. */
const LOCALE_MAP: Record<string, string> = {
  ja: "ja-jp",
  th: "th-th",
  ko: "ko-kr",
  "zh-tw": "zh-tw", // Chinese (Traditional)
  "zh-cn": "zh-cn", // Chinese (Simplified)
};
const MASTER_LOCALE = "en-us";
const HUB_TYPE_ID = "app_labels";
const KNOWN_FLAGS = new Set([
  "--locale",
  "--file",
  "--page",
  "--master",
  "--write",
  "--force-create",
  "--strict",
]);
const FLAGS_WITH_VALUE = new Set(["--locale", "--file", "--page", "--master"]);

type PrismicDoc = {
  id: string;
  uid?: string | null;
  type: string;
  lang: string;
  tags: string[];
  data: Record<string, unknown>;
};

type FieldDef = { type: string; config?: { label?: string } };
type CustomTypeModel = { id: string; json: Record<string, Record<string, FieldDef>> };

type Operation = {
  action: "create" | "update";
  modelId: string;
  title: string;
  missingKeys: string[];
  extraKeys: string[];
  emptyKeys: string[];
};

/** locale -> modelId -> ISO timestamp of the last write that may be unpublished. */
type MigrationState = Record<string, Record<string, string>>;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const customTypesRoot = path.resolve(scriptDirectory, "../customtypes");
const statePath = path.resolve(scriptDirectory, "../.locale-migration-state.json");
const defaultMasterFile = path.resolve(
  scriptDirectory,
  "../../../apps/frontend/messages/en.json",
);

let args: ReturnType<typeof parseArgs>;
let shouldWrite = false;
let forceCreate = false;
let strict = false;

loadSharedEnvIntoProcessEnv();

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});

async function main() {
  args = parseArgs(process.argv.slice(2));
  shouldWrite = args.flags.has("--write");
  forceCreate = args.flags.has("--force-create");
  strict = args.flags.has("--strict");

  const localeArg = args.values.get("--locale")?.toLowerCase();
  const fileArg = args.values.get("--file");
  const masterArg = args.values.get("--master");
  const pageFilter = args.values
    .get("--page")
    ?.split(",")
    .map((page) => page.trim())
    .filter(Boolean);

  if (!localeArg || !fileArg) {
    throw new Error(
      `Usage: --locale <${Object.keys(LOCALE_MAP).join("|")}> --file <path/to/locale.json> [--page A,B] [--master <en.json>] [--write] [--force-create] [--strict]`,
    );
  }
  const targetLocale = LOCALE_MAP[localeArg];
  if (!targetLocale) {
    throw new Error(
      `Unsupported --locale "${localeArg}". Supported: ${Object.keys(LOCALE_MAP).join(", ")}`,
    );
  }

  const incoming = readJson(path.resolve(process.cwd(), fileArg));
  const master = readJson(masterArg ? path.resolve(process.cwd(), masterArg) : defaultMasterFile);

  if (pageFilter) {
    const unknown = pageFilter.filter((page) => !(page in master));
    if (unknown.length) {
      throw new Error(`--page names not found in the English file: ${unknown.join(", ")}`);
    }
  }
  const pages = Object.keys(master).filter(
    (namespace) => !pageFilter || pageFilter.includes(namespace),
  );

  const [{ createPrismicClient }, { createPrismicMigration, createPrismicWriteClient }] =
    await Promise.all([
      import("../src/prismic/create-client.js"),
      import("../src/prismic/write-client.js"),
    ]);

  // Fail fast on configuration problems, before any lookups or writes.
  const writeClient = shouldWrite ? createPrismicWriteClient() : undefined;
  const readClient = createPrismicClient();

  const repository = await readClient.getRepository();
  const enabledLocales = (repository.languages ?? []).map((language) => language.id);
  if (!enabledLocales.includes(targetLocale)) {
    throw new Error(
      `Locale "${targetLocale}" is not enabled in the Prismic repository (enabled: ${enabledLocales.join(", ")}). Add it under Settings > Translations & locales first.`,
    );
  }

  const state = readState();
  const problems: string[] = [];
  const warnings: string[] = [];
  const operations: Operation[] = [];
  const migration = createPrismicMigration();
  const leafDocuments: Record<string, unknown> = {};

  const unexpectedPages = Object.keys(incoming).filter((namespace) => !(namespace in master));
  if (unexpectedPages.length) {
    warnings.push(`Ignoring top-level keys not present in English: ${unexpectedPages.join(", ")}`);
  }

  for (const namespace of pages) {
    const masterFields = master[namespace];
    const incomingFields = incoming[namespace];

    if (!isPlainObject(masterFields)) continue;
    if (!isPlainObject(incomingFields)) {
      warnings.push(`[${namespace}] missing in ${localeArg} file — skipped.`);
      continue;
    }

    const model = loadCustomTypeModel(namespace);
    if (!model) {
      warnings.push(`[${namespace}] no customtypes/${toModelId(namespace)}/index.json — skipped.`);
      continue;
    }

    const masterDoc = await findSingleton(readClient, model.id, MASTER_LOCALE);
    if (!masterDoc) {
      problems.push(
        `[${namespace}] no published ${MASTER_LOCALE} document for "${model.id}" — migrate and publish English first.`,
      );
      continue;
    }

    const modelKeys = Object.keys(model.json.Main ?? {});
    const missingKeys = modelKeys.filter((key) => !(key in incomingFields));
    const extraKeys = Object.keys(incomingFields).filter((key) => !modelKeys.includes(key));
    const emptyKeys: string[] = [];
    const data: Record<string, unknown> = {};
    if (strict && missingKeys.length) {
      problems.push(
        `[${namespace}] --strict: missing in ${localeArg} file: ${missingKeys.join(", ")}.`,
      );
    }
    const existing = await findSingleton(readClient, model.id, targetLocale);

    for (const key of modelKeys) {
      const englishValue = String(masterFields[key] ?? "");
      if (!(key in incomingFields)) {
        // Never overwrite an existing translation with English.
        const current = existing?.data[key];
        if (typeof current !== "string" || current === "") data[key] = englishValue;
        continue;
      }
      const value = incomingFields[key];
      if (typeof value !== "string") {
        problems.push(`[${namespace}.${key}] must be a string, got ${describeType(value)}.`);
        continue;
      }
      if (value.trim() === "" && englishValue.trim() !== "") {
        emptyKeys.push(key);
      }
      const placeholderIssue = comparePlaceholders(englishValue, value);
      if (placeholderIssue) {
        problems.push(`[${namespace}.${key}] ${placeholderIssue}`);
      }
      data[key] = value;
    }

    if (!existing && state[targetLocale]?.[model.id] && !forceCreate) {
      problems.push(
        `[${namespace}] "${model.id}" (${targetLocale}) was already written on ${state[targetLocale][model.id]} but is not published yet, so it cannot be seen. Publish the Migration Release in Prismic and re-run, or pass --force-create to create it anyway.`,
      );
      continue;
    }

    const title = toReadableLabel(namespace);
    operations.push({
      action: existing ? "update" : "create",
      modelId: model.id,
      title,
      missingKeys,
      extraKeys,
      emptyKeys,
    });

    if (!shouldWrite) continue;

    leafDocuments[model.id] = existing
      ? migration.updateDocument({ ...existing, data: { ...existing.data, ...data } }, title)
      : migration.createDocument({ type: model.id, lang: targetLocale, tags: [], data }, title, {
          masterLanguageDocument: masterDoc,
        });
  }

  printReport(localeArg, targetLocale, operations, warnings, problems);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s) found — nothing was written.`);
    process.exitCode = 1;
    return;
  }
  if (!shouldWrite) {
    console.log("\nDry run. Re-run with --write to apply.");
    return;
  }
  if (!operations.length || !writeClient) {
    console.log("\nNothing to migrate.");
    return;
  }

  // New documents live in a Migration Release, which the read API cannot see.
  // Link the hub to the migration documents directly; the client resolves them
  // to real ids inside the same migrate() call. Existing hub data is merged,
  // never replaced, so links for pages not in this run are preserved.
  const masterHub = await findSingleton(readClient, HUB_TYPE_ID, MASTER_LOCALE);
  const existingHub = await findSingleton(readClient, HUB_TYPE_ID, targetLocale);
  if (!existingHub && state[targetLocale]?.[HUB_TYPE_ID] && !forceCreate) {
    throw new Error(
      `Hub "${HUB_TYPE_ID}" (${targetLocale}) was already written on ${state[targetLocale][HUB_TYPE_ID]} but is not published yet. Publish the Migration Release in Prismic and re-run, or pass --force-create.`,
    );
  }
  if (!existingHub && !masterHub) {
    throw new Error(`No published ${MASTER_LOCALE} "${HUB_TYPE_ID}" document to translate.`);
  }

  const hubData = { ...existingHub?.data, ...leafDocuments };
  if (existingHub) {
    migration.updateDocument({ ...existingHub, data: hubData } as never, "App Labels");
  } else {
    migration.createDocument(
      { type: HUB_TYPE_ID, lang: targetLocale, tags: [], data: hubData } as never,
      "App Labels",
      { masterLanguageDocument: masterHub },
    );
  }

  await writeClient.migrate(migration, {
    reporter: (event) => console.log(`[prismic:migration] ${event.type}`),
  });

  const written = [...operations.map((operation) => operation.modelId), HUB_TYPE_ID];
  const now = new Date().toISOString();
  state[targetLocale] = {
    ...state[targetLocale],
    ...Object.fromEntries(written.map((modelId) => [modelId, now])),
  };
  writeState(state);

  console.log(
    `\nDone. ${operations.length} page(s) + hub written to a Migration Release for ${targetLocale}. Review and publish the release in Prismic, then run again if more pages remain.`,
  );
}

/** Returns a description of the mismatch, or undefined when placeholders agree. */
function comparePlaceholders(english: string, translated: string): string | undefined {
  const extract = (text: string) => (text.match(/\{[^{}]+\}/g) ?? []).sort();
  const expected = extract(english);
  const actual = extract(translated);
  if (expected.join("|") === actual.join("|")) return undefined;
  return `placeholders differ — English has [${expected.join(" ")}], file has [${actual.join(" ")}].`;
}

function printReport(
  localeArg: string,
  targetLocale: string,
  operations: Operation[],
  warnings: string[],
  problems: string[],
) {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  console.log(
    `${shouldWrite ? "Migrating" : "[dry run] Would migrate"} ${operations.length} page(s) to ${targetLocale} (--locale ${localeArg}):`,
  );
  for (const op of operations) {
    console.log(`  ${op.action} ${op.modelId} — "${op.title}"`);
    if (op.missingKeys.length) {
      console.log(`    missing in file, existing translation kept (English if none): ${op.missingKeys.join(", ")}`);
    }
    if (op.emptyKeys.length) {
      console.log(`    empty in file (English is not empty): ${op.emptyKeys.join(", ")}`);
    }
    if (op.extraKeys.length) {
      console.log(`    not in Prismic model, ignored: ${op.extraKeys.join(", ")}`);
    }
  }
  for (const problem of problems) console.error(`error: ${problem}`);
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!KNOWN_FLAGS.has(argument)) {
      throw new Error(`Unknown argument "${argument}".`);
    }
    if (FLAGS_WITH_VALUE.has(argument)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} needs a value.`);
      }
      values.set(argument, value);
      index += 1;
    } else {
      flags.add(argument);
    }
  }
  return { flags, values };
}

function readJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8").replace(/^﻿/, ""));
  } catch (error) {
    throw new Error(`${filePath} is not valid JSON.`, { cause: error });
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${filePath} must contain a JSON object.`);
  }
  return parsed;
}

function readState(): MigrationState {
  if (!existsSync(statePath)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(statePath, "utf8"));
    return isPlainObject(parsed) ? (parsed as MigrationState) : {};
  } catch {
    return {};
  }
}

function writeState(state: MigrationState) {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function loadCustomTypeModel(namespace: string): CustomTypeModel | undefined {
  const modelPath = path.join(customTypesRoot, toModelId(namespace), "index.json");
  if (!existsSync(modelPath)) return undefined;
  try {
    const model = JSON.parse(readFileSync(modelPath, "utf8")) as CustomTypeModel;
    return model?.json ? model : undefined;
  } catch {
    return undefined;
  }
}

async function findSingleton(
  client: { getSingle: (type: string, options: { lang: string }) => Promise<unknown> },
  modelId: string,
  lang: string,
): Promise<PrismicDoc | undefined> {
  try {
    return (await client.getSingle(modelId, { lang })) as PrismicDoc;
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw new Error(`Failed to look up "${modelId}" (${lang}).`, { cause: error });
  }
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (error instanceof Error && error.message.includes("No documents were returned")) {
    return true;
  }
  const e = error as { status?: number; response?: { status?: number } };
  return e.status === 404 || e.response?.status === 404;
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const details = [error.message];
  if (error.cause) details.push(`cause: ${formatError(error.cause)}`);
  return details.join("\n");
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
