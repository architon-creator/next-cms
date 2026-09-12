export type PrismicLabelDocument = {
  modelId: string;
  modelType: "page" | "custom";
  content: Record<string, unknown>;
  page?: string;
  uid?: string;
};

/**
 * Returns Prismic Custom Type IDs from an application's label document section.
 *
 * The recommended JSON shape uses a top-level `documents` object. Existing
 * top-level label documents remain supported during migration.
 */
export function getPrismicLabelDocumentTypes(
  messages: Record<string, unknown>,
): string[] {
  return Object.entries(getDocumentContainer(messages))
    .filter(([, content]) => isRecord(content))
    .map(([documentType]) => documentType);
}

/**
 * Creates Prismic document definitions from an application's locale messages.
 *
 * The registry owns document identity; each application owns its own local
 * message source until the labels are published in Prismic.
 */
export function getPrismicDocuments(
  messages: Record<string, unknown>,
): PrismicLabelDocument[] {
  const documentContainer = getDocumentContainer(messages);

  return getPrismicLabelDocumentTypes(messages).map((modelId) => ({
    modelId,
    modelType: "custom",
    content: {
      [modelId]: documentContainer[modelId],
    },
  }));
}

function getDocumentContainer(messages: Record<string, unknown>) {
  return isRecord(messages.documents) ? messages.documents : messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
