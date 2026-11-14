import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { registerEnvFallback } from "../prismic/config";

let cachedEnvOverrides: Record<string, string> | undefined;
const extraEnvDirs: string[] = [];

/**
 * Copies values found in .env files into process.env (without overriding
 * values that are already set). For scripts and server startup.
 */
export function loadSharedEnvIntoProcessEnv(options: { extraDirs?: string[] } = {}) {
  // Tooling that runs outside the cms package (e.g. packages/labels-tools)
  // passes the directory that actually holds .env / .env.local.
  for (const dir of options.extraDirs ?? []) {
    if (!extraEnvDirs.includes(dir)) {
      extraEnvDirs.push(dir);
      cachedEnvOverrides = undefined;
    }
  }

  const overrides = getEnvOverrides();

  for (const [key, value] of Object.entries(overrides)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getEnvOverrides() {
  if (cachedEnvOverrides) {
    return cachedEnvOverrides;
  }

  const cwd = process.cwd();
  const envFilePaths = [
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, ".env"),
    ...extraEnvDirs.flatMap((dir) => [
      path.resolve(dir, ".env.local"),
      path.resolve(dir, ".env"),
    ]),
    path.resolve(cwd, "../../.env.local"),
    path.resolve(cwd, "../../.env"),
  ];
  const overrides: Record<string, string> = {};

  for (const envFilePath of envFilePaths) {
    if (!existsSync(envFilePath)) {
      continue;
    }

    for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const name = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (!name || overrides[name]) {
        continue;
      }

      overrides[name] = value.replace(/^["']|["']$/g, "");
    }
  }

  cachedEnvOverrides = overrides;
  return overrides;
}

// Importing the Node entry keeps the old behaviour: getSharedEnvValue() falls
// back to the monorepo's .env files when process.env doesn't have a key.
registerEnvFallback(getEnvOverrides);
