import { getSharedEnvValue } from "../prismic/config";
import { createPrismicClient } from "../prismic/create-client";
import {
  getPrismicDocuments,
  type PrismicLabelDocument,
} from "../prismic/document-registry";

export type LabelSource = "local" | "prismic";

type PrismicDocumentData = Record<string, unknown>;

type PrismicDocumentMap = Record<
  string,
  {
    data: PrismicDocumentData;
  }
>;

type PrismicParentDocument = {
  id: string;
  lang: string;
  data: Record<string, unknown>;
};

type PrismicChildDocument = {
  id: string;
  type: string;
  lang: string;
  data: Record<string, unknown>;
};

type MappingContext = {
  rootDocumentType: string;
  rootData: PrismicDocumentData;
  pathParts: string[];
};

export type CreateLabelServiceOptions<TMessages extends Record<string, unknown>> = {
  applicationName: string;
  defaultLocale: string;
  locales: readonly string[];
  localMessages: Record<string, TMessages>;
  labelContract: TMessages;
  parentDocumentType: string;
  prismicLocaleMap: Record<string, string>;
};

/**
 * Creates an app-specific label service without coupling CMS runtime code to an app.
 */
export function createLabelService<TMessages extends Record<string, unknown>>(
  options: CreateLabelServiceOptions<TMessages>,
) {
  const _debugEnabled = isLabelFlowDebugEnabled();

  const resolveLocale = (locale: string | undefined) => {
    const resolvedLocale = options.locales.includes(locale ?? "")
      ? (locale as keyof typeof options.localMessages & string)
      : options.defaultLocale;

    return resolvedLocale;
  };

  async function getLabels(locale: string): Promise<TMessages> {
    const resolvedLocale = resolveLocale(locale);
    const source = getServerLabelSource();

    logLabelFlow("start", {
      requestedLocale: locale,
      resolvedLocale,
      source,
    });

    if (source === "prismic") {
      logLabelFlow("routing to prismic", { resolvedLocale });
      return loadFromPrismic(resolvedLocale);
    }

    logLabelFlow("routing to local messages", { resolvedLocale });
    return getLocalMessages(resolvedLocale);
  }

  async function loadFromPrismic(locale: string): Promise<TMessages> {
    return fetchPrismicLabels(locale);
  }

  async function fetchPrismicLabels(locale: string): Promise<TMessages> {
    const lang = options.prismicLocaleMap[locale] ?? locale;
    const client = createPrismicClient();
    const expectedDocumentTypes = getExpectedDocumentTypes(locale);

    logLabelFlow("fetching prismic labels", { locale, lang, expectedDocumentTypes });

    // Parent type is selected from app runtime configuration, not a static SDK union.
    const parentDocument = await fetchParentDocument(
      client,
      options.parentDocumentType,
      lang,
    );

    logLabelFlow("loaded parent document", {
      locale,
      parentDocumentType: options.parentDocumentType,
      childLinkCount: Object.keys(parentDocument.data).length,
    });
    const childIds = expectedDocumentTypes
      .map((documentType: string) =>
        findChildDocumentId(parentDocument.data, documentType),
      )
      .filter((value: string | undefined): value is string => Boolean(value));

    logLabelFlow("resolved child document ids", { locale, childIds });

    const childDocuments = (await client.getAllByIDs(childIds, {
      lang,
    })) as PrismicChildDocument[];
    logLabelFlow("loaded child documents", {
      locale,
      childDocumentTypes: childDocuments.map((document) => document.type),
    });
    const childDocumentMap = Object.fromEntries(
      childDocuments.map((document) => [document.type, document]),
    );
    const missingDocumentTypes = expectedDocumentTypes.filter(
      (documentType: string) => !childDocumentMap[documentType],
    );

    for (const documentType of missingDocumentTypes) {
      logLabelFlow(`missing document ${documentType}`, {
        locale,
        documentType,
        parentDocumentType: options.parentDocumentType,
      });
    }

    const resolvedLabels = resolvePrismicLabels(options.labelContract, childDocumentMap);
    logLabelFlow("prismic labels payload", { locale, resolvedLabels });

    return resolvedLabels;
  }

  async function fetchParentDocument(
    client: ReturnType<typeof createPrismicClient>,
    parentDocumentType: string,
    lang: string,
  ) {
    try {
      return (await client.getSingle(parentDocumentType as never, {
        lang,
      })) as PrismicParentDocument;
    } catch (error) {
      logLabelFlow(
        "prismic parent document locale lookup failed, retrying without lang",
        {
          parentDocumentType,
          lang,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      try {
        return (await client.getSingle(
          parentDocumentType as never,
        )) as PrismicParentDocument;
      } catch {
        throw new Error(
          `Unable to load Prismic parent document "${parentDocumentType}" for locale "${lang}"`,
        );
      }
    }
  }

  function getExpectedDocumentTypes(_locale: string) {
    return getPrismicDocuments(options.labelContract).map(
      (document: PrismicLabelDocument) => document.modelId,
    );
  }

  function getLocalMessages(locale: string): TMessages {
    return (
      options.localMessages[resolveLocale(locale)] ??
      options.localMessages[options.defaultLocale] ??
      (() => {
        throw new Error(`Missing local labels for ${options.applicationName}:${locale}`);
      })()
    );
  }

  return {
    getLabels,
    resolveLocale,
  };
}

/**
 * Resolves the configured server-side label source.
 */
export function getServerLabelSource(): LabelSource {
  const source = getSharedEnvValue("LABEL_SOURCE");

  return source === "prismic" ? "prismic" : "local";
}

function isLabelFlowDebugEnabled() {
  return (
    getSharedEnvValue("IBE_DEBUG_LABEL_FLOW") === "true" ||
    getSharedEnvValue("TOP_DEBUG_LABEL_FLOW") === "true"
  );
}

function logLabelFlow(message: string, details?: Record<string, unknown>) {
  if (!isLabelFlowDebugEnabled()) {
    return;
  }

  console.info(`[label-service] ${message}`, details ?? {});
}

/**
 * Maps Prismic document data back to the application's nested label contract.
 * Prefers hierarchical Group data and falls back to legacy flattened keys when needed.
 */
export function resolvePrismicLabels<T extends Record<string, unknown>>(
  template: T,
  documents: PrismicDocumentMap,
): T {
  const resolvedEntries = Object.entries(template).map(
    ([documentType, documentTemplate]) => {
      const documentData = documents[documentType]?.data ?? {};
      logLabelFlow("loaded document data", {
        documentType,
        documentData,
      });
      const context: MappingContext = {
        rootDocumentType: documentType,
        rootData: documentData,
        pathParts: [],
      };

      return [documentType, mapObject(documentTemplate, documentData, context)];
    },
  );

  return Object.fromEntries(resolvedEntries) as T;
}

function getLabelKey(context: MappingContext) {
  return context.pathParts.join(".") || context.rootDocumentType;
}

function getDebugPath(context: MappingContext) {
  return [context.rootDocumentType, ...context.pathParts].join(".");
}

function findChildDocumentId(data: Record<string, unknown>, documentType: string) {
  for (const value of Object.values(data)) {
    if (isPrismicDocumentLink(value) && value.type === documentType) {
      return value.id;
    }
  }

  return undefined;
}

function isPrismicDocumentLink(value: unknown): value is { id: string; type?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function mapObject(value: unknown, source: unknown, context: MappingContext): unknown {
  if (value === null || value === undefined) {
    return getLabelKey(context);
  }

  if (Array.isArray(value)) {
    const sourceArray = Array.isArray(source) ? source : getLegacyFieldValue(context);

    if (!Array.isArray(sourceArray)) {
      return value.map((item) => mapGroupItem(item, undefined, context));
    }

    const templateItem = value[0];

    if (templateItem === undefined) {
      return sourceArray;
    }

    return sourceArray.map((item) => mapGroupItem(templateItem, item, context));
  }

  if (isRecord(value)) {
    const sourceRecord = getObjectSource(source, context);

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const nextContext: MappingContext = {
          ...context,
          pathParts: [...context.pathParts, key],
        };

        return [key, mapObject(nestedValue, sourceRecord[key], nextContext)];
      }),
    );
  }

  return mapPrimitiveValue(value, source, getLegacyFieldValue(context), context);
}

function mapGroupItem(
  template: unknown,
  value: unknown,
  context: MappingContext,
): unknown {
  return mapObject(template, value, context);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLegacyFieldValue(context: MappingContext) {
  const nestedPathValue = getValueAtPath(context.rootData, context.pathParts);

  if (!isMissingLabelValue(nestedPathValue)) {
    return nestedPathValue;
  }

  const leafKey = context.pathParts[context.pathParts.length - 1];

  if (leafKey === undefined) {
    return nestedPathValue;
  }

  return context.rootData[leafKey];
}

function getObjectSource(
  source: unknown,
  context: MappingContext,
): Record<string, unknown> {
  if (isRecord(source)) {
    return source;
  }

  const legacyObjectSource = getLegacyObjectSource(context);

  return isRecord(legacyObjectSource) ? legacyObjectSource : {};
}

function getLegacyObjectSource(context: MappingContext) {
  const directSource = getLegacyFieldValue(context);

  if (isRecord(directSource) || Array.isArray(directSource)) {
    return directSource;
  }

  const prefix = context.pathParts.join(".");

  if (prefix.length === 0) {
    return context.rootData;
  }

  const nestedEntries = Object.entries(context.rootData).filter(([key]) =>
    key.startsWith(`${prefix}.`),
  );

  if (nestedEntries.length === 0) {
    return directSource;
  }

  const reconstructed: Record<string, unknown> = {};

  for (const [flatKey, flatValue] of nestedEntries) {
    const relativePath = flatKey.slice(prefix.length + 1).split(".");
    assignDeep(reconstructed, relativePath, flatValue);
  }

  return reconstructed;
}

function assignDeep(
  target: Record<string, unknown>,
  pathParts: string[],
  value: unknown,
) {
  if (pathParts.length === 0) {
    return;
  }

  let current = target;

  for (const part of pathParts.slice(0, -1)) {
    if (!isRecord(current[part])) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  const lastKey = pathParts[pathParts.length - 1];

  if (lastKey === undefined) {
    return;
  }

  current[lastKey] = value;
}

function getValueAtPath(source: Record<string, unknown>, pathParts: string[]): unknown {
  if (pathParts.length === 0) {
    return source;
  }

  let current: unknown = source;

  for (const part of pathParts) {
    if (!isRecord(current)) {
      current = undefined;
      break;
    }

    current = current[part];
  }

  if (current !== undefined) {
    return current;
  }

  return source[pathParts.join(".")];
}

function mapPrimitiveValue(
  _value: unknown,
  nestedSourceValue: unknown,
  legacyValue: unknown,
  context: MappingContext,
): unknown {
  const resolvedSourceValue = nestedSourceValue ?? legacyValue;
  const finalResolvedValue = isMissingLabelValue(resolvedSourceValue)
    ? getLabelKey(context)
    : resolvedSourceValue;

  logLabelFlow("resolved label value", {
    path: getDebugPath(context),
    nestedSourceValue,
    legacyValue,
    finalResolvedValue,
  });

  return finalResolvedValue;
}

function isMissingLabelValue(value: unknown) {
  return value === undefined || value === null || value === "";
}
