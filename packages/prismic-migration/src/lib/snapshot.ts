import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RepoConfig } from "../config.js";
import { getMasterRef, iterateAllDocuments, listAssets } from "./prismic-http.js";
import { log } from "./logger.js";

/**
 * Full export of a repository's published documents + asset manifest, as
 * raw JSON, written to a timestamped file. This is the restore point rule
 * #2 requires: taken immediately before a migration run touches anything.
 *
 * What this is NOT: a rollback mechanism. It captures state to replay from
 * by hand if something goes wrong — actually restoring from it (recreating
 * or overwriting documents to match) is a separate, not-yet-built runbook.
 * Treat a snapshot as evidence and a diffing baseline, not an "undo button".
 */
export async function takeSnapshot(
  repo: RepoConfig,
  label: string,
  snapshotDir: string,
): Promise<string> {
  await mkdir(snapshotDir, { recursive: true });

  const ref = await getMasterRef(repo);
  const documents = [];
  for await (const doc of iterateAllDocuments(repo, ref)) {
    documents.push(doc);
  }
  const assets = await listAssets(repo);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = join(snapshotDir, `${label}-${timestamp}.json`);

  await writeFile(
    filePath,
    JSON.stringify(
      {
        repository: repo.repository,
        takenAt: new Date().toISOString(),
        ref,
        documents,
        assets,
      },
      null,
      2,
    ),
    "utf8",
  );

  log("info", "snapshot.taken", {
    repository: repo.repository,
    filePath,
    documentCount: documents.length,
    assetCount: assets.length,
  });
  return filePath;
}
