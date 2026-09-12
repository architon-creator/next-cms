import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismicDocuments, type PrismicLabelDocument } from "@repo/cms/prismic";
import { getPrismicLabelSource, loadPrismicLabelMessages } from "./label-source-loader";

type PrismicField =
  | {
      type: "StructuredText" | "Text" | "UID";
      config: {
        label: string;
        single?: string;
      };
    }
  | {
      type: "Link";
      config: {
        label: string;
        select: "document";
        customtypes: string[];
      };
    }
  | {
      type: "Group";
      config: {
        label: string;
        repeat: boolean;
        fields: Record<string, PrismicField>;
      };
    };

type PrismicModel = {
  id: string;
  label: string;
  format: "custom";
  repeatable: false;
  status: true;
  json: {
    [tabName: string]: Record<string, PrismicField>;
  };
};

const outputRoot = path.resolve("customtypes");
const labelSource = getPrismicLabelSource(readArgValue("--source"));
const documents = getPrismicDocuments(loadPrismicLabelMessages(labelSource, "en"));

if (isMainModule()) {
  for (const document of documents) {
    // if (document.modelId !== "migration_test_page") {
    //  continue;
    // }

    writeModel(document.modelId, createPrismicModel(document));
  }

  writeModel(labelSource.parentDocumentType, createIbeModel(documents));
}

export function createPrismicModel(document: PrismicLabelDocument): PrismicModel {
  const tabs = createPrismicTabs(document);

  if (document.modelType === "page") {
    tabs.Main.uid = {
      type: "UID",
      config: {
        label: "UID",
      },
    };
  }

  return {
    id: document.modelId,
    label: toReadableLabel(document.modelId),
    format: "custom",
    repeatable: false,
    status: true,
    json: {
      ...tabs,
    },
  };
}

export function createIbeModel(documents: PrismicLabelDocument[]): PrismicModel {
  const mainFields = Object.fromEntries(
    documents
      .filter((document) => document.modelId !== "ibe")
      .map((document) => [
        document.modelId,
        {
          type: "Link",
          config: {
            label: toReadableLabel(document.modelId),
            select: "document" as const,
            customtypes: [document.modelId],
          },
        } satisfies PrismicField,
      ]),
  );

  return {
    id: "ibe",
    label: "IBE",
    format: "custom",
    repeatable: false,
    status: true,
    json: {
      Main: mainFields,
    },
  };
}

function createPrismicTabs(document: PrismicLabelDocument) {
  const tabs: Record<string, Record<string, PrismicField>> = {
    Main: {},
  };

  const rootContent = unwrapDocumentRoot(document.modelId, document.content);

  if (!isPlainObject(rootContent)) {
    return tabs;
  }

  for (const [fieldName, value] of Object.entries(rootContent)) {
    if (isPlainObject(value)) {
      tabs[toReadableLabel(fieldName)] = Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          createFieldFromValue(`${fieldName}.${key}`, nestedValue),
        ]),
      );
    } else {
      tabs.Main[fieldName] = createFieldFromValue(fieldName, value);
    }
  }

  return tabs;
}

function createFieldFromValue(pathKey: string, value: unknown): PrismicField {
  if (isArrayOfObjects(value)) {
    return createGroupField(pathKey, value, true);
  }

  if (isPlainObject(value)) {
    return createGroupField(pathKey, value, false);
  }

  return createTextField(pathKey);
}

function createGroupField(
  pathKey: string,
  value: Record<string, unknown> | Array<Record<string, unknown>>,
  repeat: boolean,
): PrismicField {
  const groupSource = Array.isArray(value) ? (value[0] ?? {}) : value;
  const fields: Record<string, PrismicField> = {};

  for (const [key, nestedValue] of Object.entries(groupSource)) {
    fields[key] = createFieldFromValue(`${pathKey}.${key}`, nestedValue);
  }

  return {
    type: "Group",
    config: {
      label: toReadableLabel(pathKey.split(".").at(-1) ?? pathKey),
      repeat,
      fields,
    },
  };
}

function isArrayOfObjects(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item && typeof item === "object" && !Array.isArray(item))
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapDocumentRoot(modelId: string, content: unknown): unknown {
  if (!isPlainObject(content)) {
    return content;
  }

  const directRoot = content[modelId];

  if (isPlainObject(directRoot)) {
    return directRoot;
  }

  const snakeCaseModelId = modelId.replace(/-/g, "_");
  const snakeCaseRoot = content[snakeCaseModelId];

  if (isPlainObject(snakeCaseRoot)) {
    return snakeCaseRoot;
  }

  return content;
}

function createTextField(pathKey: string): PrismicField {
  const label = toReadableLabel(pathKey.split(".").at(-1) ?? pathKey);
  const normalizedPath = pathKey.toLowerCase();
  const pathParts = normalizedPath.split(".");
  const fieldName = pathParts[pathParts.length - 1] ?? normalizedPath;
  const isSeoField = normalizedPath.startsWith("seo.");
  const isTitleField = fieldName === "title";
  const isSubtitleField = fieldName === "subtitle";
  const isDescriptionField = fieldName === "description";
  const isPopularRoutesTitle =
    normalizedPath === "sections.popularroutes.title" ||
    normalizedPath === "sections.popular_routes.title";
  const isLongText = !isSeoField && (isTitleField || isSubtitleField || isDescriptionField);

  if (isLongText) {
    return {
      type: "StructuredText",
      config: {
        label,
        single: isPopularRoutesTitle
          ? "heading2,heading3,strong,em"
          : isTitleField
            ? "heading1,heading2,strong,em"
            : "paragraph,strong,em",
      },
    };
  }

  return {
    type: "Text",
    config: {
      label,
    },
  };
}

export function createFieldId(pathKey: string) {
  return pathKey
    .replace(/\./g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function toReadableLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bCta\b/g, "CTA");
}

function isMainModule() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}

function writeModel(modelId: string, model: PrismicModel) {
  const outputDirectory = path.join(outputRoot, modelId);

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, "index.json"), `${JSON.stringify(model, null, 2)}\n`);
}
