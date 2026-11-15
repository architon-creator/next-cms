import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSharedEnvIntoProcessEnv } from "@architon-creator/cms/node";

/**
 * Where the labels tooling reads/writes. `cms` lives in its own repo now, so
 * the customtypes/ directory is resolved in this order:
 *
 *   1. CMS_DIR env var        an explicit checkout of the cms repo
 *   2. ../cms next to this repo   a sibling checkout (the usual local setup)
 *   3. the installed package  read-only; fine for status/drift/seed, but
 *                             `generate` refuses to write into node_modules
 *
 * Other overrides:
 *   LABELS_MESSAGES    path to the web app's en.json
 */
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../../..");

function resolveCmsDir(): { dir: string; isInstalledCopy: boolean } {
  if (process.env.CMS_DIR) {
    return { dir: path.resolve(process.env.CMS_DIR), isInstalledCopy: false };
  }

  const sibling = path.resolve(repoRoot, "../cms");
  if (existsSync(path.join(sibling, "customtypes"))) {
    return { dir: sibling, isInstalledCopy: false };
  }

  const installed = path.dirname(
    createRequire(path.join(scriptDirectory, "package.json")).resolve(
      "@architon-creator/cms/package.json",
    ),
  );
  return { dir: installed, isInstalledCopy: true };
}

const resolved = resolveCmsDir();

export const cmsDir = resolved.dir;
export const customTypesRoot = path.join(cmsDir, "customtypes");
export const messagesPath = path.resolve(
  process.env.LABELS_MESSAGES ?? path.join(repoRoot, "apps/frontend/messages/en.json"),
);

/** Call before writing into customtypes/ — never write into node_modules. */
export function assertCustomTypesWritable() {
  if (resolved.isInstalledCopy) {
    throw new Error(
      "customtypes/ resolved to the installed @architon-creator/cms package " +
        "(read-only). Set CMS_DIR to a checkout of the cms repo, or place one " +
        `next to this repo at ${path.resolve(repoRoot, "../cms")}, then run again — ` +
        "and open a PR in the cms repo with the generated files.",
    );
  }
}

/** Loads .env files (cwd, the cms dir, then the repo root) into process.env. */
export function loadEnv() {
  loadSharedEnvIntoProcessEnv({ extraDirs: [cmsDir] });
}
