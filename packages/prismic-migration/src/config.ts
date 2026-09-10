export type RepoConfig = {
  repository: string;
  /** Read-only token for the content API v2 (dev/sit reads). Omit for a public repo. */
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
  dev: RepoConfig;
  sit: RepoConfig;
  mappingDir: string;
  snapshotDir: string;
  reportDir: string;
  cacheDir: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * Loads and validates config from the environment. Read once, at process
 * start (see cli.ts) — every phase function takes this as a parameter
 * rather than reading env vars itself, which is what keeps the phase
 * functions unit-testable without mutating process.env.
 */
export function loadConfig(): Config {
  return {
    dev: {
      repository: required("DEV_REPOSITORY"),
      accessToken: process.env.DEV_ACCESS_TOKEN || undefined,
      migrationToken: required("DEV_MIGRATION_TOKEN"),
    },
    sit: {
      repository: required("SIT_REPOSITORY"),
      accessToken: process.env.SIT_ACCESS_TOKEN || undefined,
      migrationToken: required("SIT_MIGRATION_TOKEN"),
    },
    mappingDir: process.env.MAPPING_DIR || "./data",
    snapshotDir: process.env.SNAPSHOT_DIR || "./snapshots",
    reportDir: process.env.REPORT_DIR || "./reports",
    cacheDir: process.env.CACHE_DIR || "./.cache",
  };
}
