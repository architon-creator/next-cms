import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  getPrismicDocuments,
  getSharedEnvValue,
  loadSharedEnvIntoProcessEnv,
  type PrismicLabelDocument,
} from "@repo/cms/prismic";
import { createPrismicModel } from "./generate-prismic-models";
import { getPrismicLabelSource, loadPrismicLabelMessages } from "./label-source-loader";

type ExistingDocument = {
  id: string;
  uid?: string | null;
  type: string;
  lang: string;
  tags: string[];
  data: Record<string, unknown>;
};

type SeedOperation = {
  action: "create" | "update";
  modelId: string;
  uid?: string;
  title: string;
  fieldCount: number;
  documentId?: string;
};

const locale = readArgValue("--locale") ?? "en";
const shouldWrite = process.argv.includes("--write");
const prismicLocale = toPrismicLocale(locale);

loadSharedEnvIntoProcessEnv();

const labelSource = getPrismicLabelSource(readArgValue("--source"));
const documents = getPrismicDocuments(loadPrismicLabelMessages(labelSource, locale));

main().catch((error) => {
  console.error(formatError(error));
  process.exit(1);
});

async function main() {
  await seedContent();
}

async function seedContent() {
  const [{ createPrismicClient }, { createPrismicMigration, createPrismicWriteClient }] =
    await Promise.all([
      import("../../../packages/cms/src/prismic/create-client"),
      import("../src/prismic/write-client"),
    ]);
  const migration = createPrismicMigration();
  const readClient = createPrismicClient();
  const operations: SeedOperation[] = [];

  for (const document of documents) {
    const title = createDocumentTitle(document);
    const data = createPrismicDocumentData(document);
    const manualDocumentId = getDocumentIdOverride(document.modelId, locale);

    if (!shouldWrite) {
      operations.push({
        action: manualDocumentId ? "update" : "create",
        modelId: document.modelId,
        uid: document.uid,
        title,
        fieldCount: Object.keys(data).length,
        documentId: manualDocumentId,
      });
      continue;
    }

    const existingDocument = await findExistingDocument(readClient, document);
    const operation: SeedOperation = {
      action: existingDocument || manualDocumentId ? "update" : "create",
      modelId: document.modelId,
      uid: document.uid,
      title,
      fieldCount: Object.keys(data).length,
      documentId: manualDocumentId ?? existingDocument?.id,
    };

    operations.push(operation);

    if (existingDocument) {
      migration.updateDocument(
        {
          ...existingDocument,
          data,
        },
        title,
      );
      continue;
    }
    migration.createDocument(
      {
        type: document.modelId,
        uid: document.uid,
        lang: prismicLocale,
        tags: [],
        data,
      },
      title,
    );
  }

  if (shouldWrite) {
    const writeClient = createPrismicWriteClient();

    for (const document of documents) {
      const documentId = getDocumentIdOverride(document.modelId, locale);

      if (!documentId) {
        continue;
      }

      const title = createDocumentTitle(document);
      const data = createPrismicDocumentData(document);

      await writeClient.updateDocument(documentId, {
        documentTitle: title,
        uid: document.uid,
        tags: [],
        data,
      });
    }

    const hasCreateOrLookupUpdates = operations.some(
      (operation) => !getDocumentIdOverride(operation.modelId, locale),
    );

    if (!hasCreateOrLookupUpdates) {
      return operations;
    }

    await writeClient.migrate(migration, {
      reporter: (event) => {
        formatMigrationEvent(event);
      },
    });
  }

  return operations;
}

function formatMigrationEvent(event: {
  type: string;
  data?: {
    current?: number;
    total?: number;
    document?: {
      document?: {
        type?: string;
        uid?: string;
      };
    };
  };
}) {
  const document = event.data?.document?.document;
  const progress =
    event.data?.current && event.data?.total
      ? ` ${event.data.current}/${event.data.total}`
      : "";
  const documentLabel = document
    ? ` ${document.type}${document.uid ? `:${document.uid}` : ""}`
    : "";

  return `[prismic:migration] ${event.type}${progress}${documentLabel}`;
}

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const response = (error as { response?: unknown }).response;
  const cause = (error as { cause?: unknown }).cause;
  const details: string[] = [error.message];

  if (response) {
    details.push(`response=${JSON.stringify(response, null, 2)}`);
  }

  if (cause) {
    details.push(`cause=${formatUnknown(cause)}`);
  }

  if (error.stack) {
    details.push(error.stack);
  }

  return details.join("\n");
}

async function findExistingDocument(
  client: {
    getByUID: (type: string, uid: string, options: { lang: string }) => Promise<unknown>;
    getSingle: (type: string, options: { lang: string }) => Promise<unknown>;
  },
  document: PrismicLabelDocument,
): Promise<ExistingDocument | undefined> {
  try {
    if (document.uid) {
      return (await client.getByUID(document.modelId, document.uid, {
        lang: prismicLocale,
      })) as ExistingDocument;
    }

    return (await client.getSingle(document.modelId, {
      lang: prismicLocale,
    })) as ExistingDocument;
  } catch (error) {
    if (!isPrismicNotFoundError(error)) {
      throw new Error(
        `Failed to look up existing Prismic document for type "${document.modelId}"${document.uid ? ` and uid "${document.uid}"` : ""}.`,
        { cause: error },
      );
    }

    return undefined;
  }
}

function isPrismicNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error instanceof Error && error.message.includes("No documents were returned")) {
    return true;
  }

  const errorWithStatus = error as {
    status?: number;
    response?: {
      status?: number;
    };
  };

  return errorWithStatus.status === 404 || errorWithStatus.response?.status === 404;
}

function formatUnknown(value: unknown) {
  if (value instanceof Error) {
    const parts = [value.message];

    if (value.stack) {
      parts.push(value.stack);
    }

    return parts.join("\n");
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createPrismicDocumentData(document: PrismicLabelDocument) {
  const model = loadCustomTypeModel(document.modelId) ?? createPrismicModel(document);
  const rootContent = unwrapDocumentRoot(document.modelId, document.content);
  const rootRecord = isRecord(rootContent) ? rootContent : {};
  const data: Record<string, unknown> = {};

  for (const [tabName, tabFields] of Object.entries(model.json)) {
    const tabSource = getTabSource(tabName, rootRecord);

    for (const [fieldName, rawField] of Object.entries(tabFields)) {
      const field = rawField as PrismicField;

      if (!isSeedableField(field)) {
        continue;
      }

      const fieldValue = tabSource[fieldName];

      data[fieldName] = toPrismicFieldValue({
        field,
        value: fieldValue,
      });
    }
  }

  return data;
}

function loadCustomTypeModel(modelId: string): PrismicCustomTypeModel | undefined {
  const modelPath = path.resolve(process.cwd(), "customtypes", modelId, "index.json");

  if (!existsSync(modelPath)) {
    return undefined;
  }

  try {
    const model = JSON.parse(readFileSync(modelPath, "utf8")) as PrismicCustomTypeModel;

    if (!model?.json || typeof model.json !== "object") {
      return undefined;
    }

    return model;
  } catch {
    return undefined;
  }
}

function getTabSource(tabName: string, rootRecord: Record<string, unknown>) {
  if (tabName === "Main") {
    return rootRecord;
  }

  const namespace = toSnakeCase(tabName);
  const namespaceValue = rootRecord[namespace];

  if (isRecord(namespaceValue)) {
    return namespaceValue;
  }

  return {};
}

function isSeedableField(field: PrismicField): field is PrismicSeedField {
  return (
    field.type === "Text" ||
    field.type === "StructuredText" ||
    field.type === "UID" ||
    field.type === "Group"
  );
}

function toPrismicFieldValue({
  field,
  value,
}: {
  field: PrismicSeedField;
  value: unknown;
}): unknown {
  if (field.type === "Group") {
    return toPrismicGroupValue(value, field.config.fields, field.config.repeat);
  }

  const text = String(value ?? "");

  if (field.type !== "StructuredText") {
    return text;
  }

  return [
    {
      type: selectStructuredTextBlockType(field.config?.single),
      text,
      spans: [],
    },
  ];
}

function toPrismicGroupValue(
  value: unknown,
  fields: Record<string, PrismicSeedField>,
  repeat: boolean,
): unknown {
  if (repeat) {
    if (isRecord(value)) {
      return [mapGroupObject(value, fields)];
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => mapGroupObject(item, fields));
  }

  return mapGroupObject(value, fields);
}
function mapGroupObject(value: unknown, fields: Record<string, PrismicSeedField>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, nestedField]) => [
      key,
      toPrismicFieldValue({
        field: nestedField,
        value: (value as Record<string, unknown>)[key],
      }),
    ]),
  );
}

type PrismicCustomTypeModel = {
  id?: string;
  json: Record<string, Record<string, PrismicField>>;
};

type PrismicField =
  | {
      type: "StructuredText" | "Text" | "UID";
      config?: {
        label?: string;
        single?: string;
      };
    }
  | {
      type: "Group";
      config: {
        label: string;
        repeat: boolean;
        fields: Record<string, PrismicField>;
      };
    }
  | {
      type: "Link";
      config: {
        label: string;
        select: "document";
        customtypes: string[];
      };
    };

function selectStructuredTextBlockType(single?: string) {
  const supportedBlockTypes = [
    "heading1",
    "heading2",
    "heading3",
    "heading4",
    "heading5",
    "heading6",
    "paragraph",
  ];
  const configuredTypes =
    single
      ?.split(",")
      .map((type) => type.trim())
      .filter(Boolean) ?? [];

  return (
    configuredTypes.find((type) => supportedBlockTypes.includes(type)) ?? "paragraph"
  );
}

function createDocumentTitle(document: PrismicLabelDocument) {
  if (document.page && typeof document.page === "string") {
    return `${toReadableLabel(document.page)} Page`;
  }

  return toReadableLabel(document.modelId);
}

function toReadableLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toPrismicLocale(value: string) {
  const localeMap: Record<string, string> = {
    en: "en-us",
    ja: "ja-jp",
  };

  return localeMap[value] ?? value;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}

function getDocumentIdOverride(modelId: string, locale: string) {
  const key = [
    "PRISMIC",
    modelId.toUpperCase(),
    locale.toUpperCase(),
    "DOCUMENT_ID",
  ].join("_");

  const value = getSharedEnvValue(key);

  return value?.trim() ? value.trim() : undefined;
}

function unwrapDocumentRoot(modelId: string, content: unknown): unknown {
  if (!isRecord(content)) {
    return content;
  }

  const directRoot = content[modelId];

  if (isRecord(directRoot)) {
    return directRoot;
  }

  const snakeCaseModelId = modelId.replace(/-/g, "_");
  const snakeCaseRoot = content[snakeCaseModelId];

  if (isRecord(snakeCaseRoot)) {
    return snakeCaseRoot;
  }

  return content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

type PrismicSeedField =
  | {
      type: "StructuredText" | "Text" | "UID";
      config?: {
        label?: string;
        single?: string;
      };
    }
  | {
      type: "Group";
      config: {
        label: string;
        repeat: boolean;
        fields: Record<string, PrismicSeedField>;
      };
    };
