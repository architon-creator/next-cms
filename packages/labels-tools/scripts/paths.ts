import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSharedEnvIntoProcessEnv } from "@architon-creator/cms/node";

/**
 * Where the labels tooling reads/writes. Defaults match this monorepo; once
 * `cms` lives in its own repo, point these at checkouts via env vars:
 *   CMS_DIR            directory holding customtypes/ and the cms .env files
 *   LABELS_MESSAGES    path to the web app's en.json
 */
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const cmsDir = path.resolve(
  process.env.CMS_DIR ?? path.resolve(scriptDirectory, "../../cms"),
);
export const customTypesRoot = path.join(cmsDir, "customtypes");
export const messagesPath = path.resolve(
  process.env.LABELS_MESSAGES ??
    path.resolve(scriptDirectory, "../../../apps/frontend/messages/en.json"),
);

/** Loads .env files (cwd, the cms dir, then the repo root) into process.env. */
export function loadEnv() {
  loadSharedEnvIntoProcessEnv({ extraDirs: [cmsDir] });
}
