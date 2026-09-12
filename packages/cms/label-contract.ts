import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

export type CreateLabelContractFromCustomTypesOptions = {
    customTypesRoot: string;
    parentDocumentType: string;
};

/**
 * Builds the runtime label contract from Prismic custom type metadata.
 */
export function createLabelContractFromCustomTypes<T extends Record<string, unknown>>(
    options: CreateLabelContractFromCustomTypesOptions,
): T {
    const models = loadCustomTypeModels(options.customTypesRoot);

    const documentTypes = resolveLabelDocumentTypes(models, options.parentDocumentType);

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

/**
 * Backward-compatible alias.
 */
export const buildLabelContractFromCustomTypes = createLabelContractFromCustomTypes;

function loadCustomTypeModels(customTypesRoot: string): Record<string, PrismicCustomTypeModel> {
    const modelDirectories = readdirSync(customTypesRoot, {
        withFileTypes: true,
    }).filter((entry) => entry.isDirectory());

    const models: Record<string, PrismicCustomTypeModel> = {};

    for (const directory of modelDirectories) {
        try {
            const modelPath = path.join(customTypesRoot, directory.name, "index.json");

            const model = JSON.parse(readFileSync(modelPath, "utf8")) as PrismicCustomTypeModel;

            if (model?.id && model?.json) {
                models[model.id] = model;
            }
        } catch {
            // Ignore malformed or non-model folders.
        }
    }

    return models;
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
        .filter((field): field is Extract<PrismicField, { type: "Link" }> => field.type === "Link")
        .flatMap((field) => field.config.customtypes)
        .filter(Boolean);

    return Array.from(new Set(linkedDocumentTypes));
}

/**
 * Converts one custom type into a runtime contract.
 */
export function customTypeModelToContract(model: PrismicCustomTypeModel): Record<string, unknown> {
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