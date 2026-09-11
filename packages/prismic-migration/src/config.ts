export type RepoConfig = {
  repository: string;
  /** Read-only token for the content API v2. Omit for a public repo. */
  accessToken?: string;
  /**
   * Write-scoped permanent token for the Migration/Asset/Custom Types APIs
   * (generate with `npx prismic token create --write`). Materially
   * higher-privilege than accessToken — never let this reach a log line,
   * a mapping file, or an error message.
   */
  migrationToken: string;
};

export type Config = {
  /** Every environment actually configured (has a `<NAME>_REPOSITORY` env var) — not necessarily all of environmentChain. */
  environments: Record<string, RepoConfig>;
  /** Ordered lowest to highest, e.g. ["dev", "sit", "uat", "prod"] — defines what counts as "adjacent" for lib/environments.ts. */
  environmentChain: string[];
  mappingDir: string;
  snapshotDir: string;
  reportDir: string;
  cacheDir: string;
};

/**
 * Loads one environment's RepoConfig from `<NAME>_REPOSITORY` /
 * `<NAME>_ACCESS_TOKEN` / `<NAME>_MIGRATION_TOKEN`. Returns undefined
 * (not an error) when `<NAME>_REPOSITORY` is unset — an environment you
 * don't use yet (e.g. PROD, before it exists) shouldn't force you to set
 * dummy env vars for it. lib/environments.ts is what turns "not
 * configured" into a clear error, at the point a command actually tries
 * to use that environment.
 */
function loadEnvironment(name: string): RepoConfig | undefined {
  const prefix = name.toUpperCase();
  const repository = process.env[`${prefix}_REPOSITORY`];
  if (!repository) return undefined;

  const migrationToken = process.env[`${prefix}_MIGRATION_TOKEN`];
  if (!migrationToken) {
    throw new Error(
      `${prefix}_REPOSITORY is set but ${prefix}_MIGRATION_TOKEN is missing — both are required together.`,
    );
  }

  return {
    repository,
    accessToken: process.env[`${prefix}_ACCESS_TOKEN`] || undefined,
    migrationToken,
  };
}

/**
 * Loads and validates config from the environment. Read once, at process
 * start (see cli.ts) — every phase function takes this as a parameter
 * rather than reading env vars itself, which is what keeps the phase
 * functions unit-testable without mutating process.env.
 */
export function loadConfig(): Config {
  const environmentChain = (process.env.ENVIRONMENT_CHAIN || "dev,sit,uat,prod")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const environments: Record<string, RepoConfig> = {};
  for (const name of environmentChain) {
    const repo = loadEnvironment(name);
    if (repo) environments[name] = repo;
  }

  return {
    environments,
    environmentChain,
    mappingDir: process.env.MAPPING_DIR || "./data",
    snapshotDir: process.env.SNAPSHOT_DIR || "./snapshots",
    reportDir: process.env.REPORT_DIR || "./reports",
    cacheDir: process.env.CACHE_DIR || "./.cache",
  };
}
