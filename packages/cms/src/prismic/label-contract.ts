// Platform-neutral: no Node built-ins here. Reading customtypes/ from disk lives
// in src/node/label-contract-fs.ts so React Native can import this file.
export type PrismicField =
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

export type PrismicCustomTypeModel = {
  id: string;
  json: Record<string, Record<string, PrismicField>>;
};

/**
 * Builds the runtime label contract from already-loaded custom type models.
 * Mobile can feed this a bundled JSON snapshot of the models.
 */
export function createLabelContractFromModels<T extends Record<string, unknown>>(
  models: Record<string, PrismicCustomTypeModel>,
  parentDocumentType: string,
): T {
  const documentTypes = resolveLabelDocumentTypes(models, parentDocumentType);

  const contract = Object.fromEntries(
    documentTypes.flatMap((documentType) => {
      const model = models[documentType];

      if (!model) {
        return [];
      }

      return [[documentType, customTypeModelToContract(model)]];
    }),
  );

  return contract as T;
}

function resolveLabelDocumentTypes(
  models: Record<string, PrismicCustomTypeModel>,
  parentDocumentType: string,
): string[] {
  const parentModel = models[parentDocumentType];

  if (parentModel) {
    const linkedDocumentTypes = extractLinkedDocumentTypes(parentModel);

    if (linkedDocumentTypes.length > 0) {
      return linkedDocumentTypes;
    }
  }

  return Object.keys(models).filter((modelId) => modelId !== parentDocumentType);
}

function extractLinkedDocumentTypes(model: PrismicCustomTypeModel): string[] {
  const mainTab = model.json.Main ?? {};

  const linkedDocumentTypes = Object.values(mainTab)
    .filter(
      (field): field is Extract<PrismicField, { type: "Link" }> => field.type === "Link",
    )
    .flatMap((field) => field.config.customtypes)
    .filter(Boolean);

  return Array.from(new Set(linkedDocumentTypes));
}

/**
 * Converts one custom type into a runtime contract.
 */
export function customTypeModelToContract(
  model: PrismicCustomTypeModel,
): Record<string, unknown> {
  const contract: Record<string, unknown> = {};

  for (const [tabName, fields] of Object.entries(model.json)) {
    if (tabName === "Main") {
      Object.assign(contract, prismicFieldsToContract(fields));
      continue;
    }

    const namespace = tabNameToNamespace(tabName);

    const namespaceField = fields[namespace];

    if (namespaceField?.type === "Group" && namespaceField.config.repeat === false) {
      contract[namespace] = prismicFieldToContractValue(namespaceField);

      continue;
    }

    contract[namespace] = prismicFieldsToContract(fields);
  }

  return contract;
}

/**
 * Converts a set of Prismic fields into a contract object.
 */
export function prismicFieldsToContract(
  fields: Record<string, PrismicField>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, field]) => field.type !== "Link")
      .map(([fieldName, field]) => [fieldName, prismicFieldToContractValue(field)]),
  );
}

/**
 * Converts an individual field.
 */
export function prismicFieldToContractValue(field: PrismicField): unknown {
  if (field.type === "Group") {
    const itemTemplate = prismicFieldsToContract(field.config.fields);

    return field.config.repeat ? [itemTemplate] : itemTemplate;
  }

  return "";
}

/**
 * Converts tab names into namespaces.
 *
 * Examples:
 * Validation -> validation
 * Calendar -> calendar
 * Description Group -> description_group
 */
export function tabNameToNamespace(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}
