/**
 * Platform-neutral config. This module must stay free of Node built-ins so the
 * core "cms" entry works in React Native/Expo as well as on the web.
 *
 * Values resolve in this order: explicit `configureCms()` values, then
 * `process.env` (when a `process` exists), then an optional fallback provider
 * (the Node entry registers one that reads monorepo .env files).
 */
const explicitValues: Record<string, string | undefined> = {};
let envFallback: (() => Record<string, string>) | undefined;

/**
 * Sets config values explicitly (e.g. from Expo public env vars on mobile).
 * Keys use the same names as the env vars, e.g. PRISMIC_REPOSITORY_NAME.
 */
export function configureCms(values: Record<string, string | undefined>) {
  Object.assign(explicitValues, values);
}

/** Registers a lower-priority env source. Used by the "cms/node" entry. */
export function registerEnvFallback(provider: () => Record<string, string>) {
  envFallback = provider;
}

export const prismicConfig = {
  get repositoryName() {
    return getSharedEnvValue("PRISMIC_REPOSITORY_NAME") ?? "zipair-dev";
  },
  get accessToken() {
    return getSharedEnvValue("PRISMIC_ACCESS_TOKEN");
  },
  get migrationSourceRepositoryName() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_SOURCE_REPOSITORY_NAME") ??
      getSharedEnvValue("PRISMIC_SOURCE_REPOSITORY_NAME")
    );
  },
  get migrationSourceAccessToken() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_SOURCE_ACCESS_TOKEN") ??
      getSharedEnvValue("PRISMIC_SOURCE_ACCESS_TOKEN")
    );
  },
  get migrationTargetRepositoryName() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_TARGET_REPOSITORY_NAME") ??
      getSharedEnvValue("PRISMIC_TARGET_REPOSITORY_NAME")
    );
  },
  get migrationTargetAccessToken() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_TARGET_ACCESS_TOKEN") ??
      getSharedEnvValue("PRISMIC_TARGET_ACCESS_TOKEN")
    );
  },
  get migrationTargetWriteToken() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_TARGET_WRITE_TOKEN") ??
      getSharedEnvValue("PRISMIC_TARGET_WRITE_TOKEN")
    );
  },
  get migrationStrategy() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_STRATEGY") ??
      getSharedEnvValue("MIGRATION_STRATEGY")
    );
  },
  get migrationValue() {
    return (
      getSharedEnvValue("PRISMIC_MIGRATION_VALUE") ?? getSharedEnvValue("MIGRATION_VALUE")
    );
  },
  routes: [],
} as const;

export function getSharedEnvValue(key: string) {
  const explicit = explicitValues[key];

  if (explicit !== undefined) {
    return explicit;
  }

  if (typeof process !== "undefined" && process.env) {
    const fromProcess = process.env[key];

    if (fromProcess !== undefined) {
      return fromProcess;
    }
  }

  return envFallback?.()[key];
}
