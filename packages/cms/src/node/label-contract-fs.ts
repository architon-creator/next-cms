import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  createLabelContractFromModels,
  type PrismicCustomTypeModel,
} from "../prismic/label-contract";

export type CreateLabelContractFromCustomTypesOptions = {
  customTypesRoot: string;
  parentDocumentType: string;
};

/**
 * Builds the runtime label contract by reading customtypes/<id>/index.json from disk.
 */
export function createLabelContractFromCustomTypes<T extends Record<string, unknown>>(
  options: CreateLabelContractFromCustomTypesOptions,
): T {
  return createLabelContractFromModels<T>(
    loadCustomTypeModels(options.customTypesRoot),
    options.parentDocumentType,
  );
}

/**
 * Backward-compatible alias.
 */
export const buildLabelContractFromCustomTypes = createLabelContractFromCustomTypes;

function loadCustomTypeModels(
  customTypesRoot: string,
): Record<string, PrismicCustomTypeModel> {
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
