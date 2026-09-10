import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import {
  createMigrationDocument,
  getMasterRef,
  iterateAllDocuments,
  listCustomTypes,
  PrismicApiError,
  updateMigrationDocument,
} from "../lib/prismic-http.js";
import { rewriteRefs } from "../lib/rewrite-refs.js";
import type { AssetMapping, DocumentMapping, PrismicDocument } from "../types.js";

export type Phase2Options = {
  config: Config;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type Phase2Failure = {
  devId: string;
  docType: string;
  operation: "create" | "update" | "link_fixup";
  message: string;
  status?: number;
  body?: string;
};

export type Phase2Result = {
  seen: number;
  created: number;
  updated: number;
  unchanged: number;
  linkFixups: number;
  failures: Phase2Failure[];
};

function toFailure(
  doc: { id: string; type: string },
  operation: Phase2Failure["operation"],
  err: unknown,
): Phase2Failure {
  const failure: Phase2Failure = {
    devId: doc.id,
    docType: doc.type,
    operation,
    message: err instanceof Error ? err.message : String(err),
  };
  if (err instanceof PrismicApiError) {
    failure.status = err.status;
    failure.body = err.body;
  }
  return failure;
}

function cachePathFor(cacheDir: string, devId: string): string {
  return join(cacheDir, "dev-docs", `${devId}.json`);
}

/**
 * The Migration API's `title` is purely a display label for the Migration
 * Release list — Prismic doesn't derive it from the document's own
 * content, so something has to be supplied. Prefers `uid` (human-chosen,
 * usually unique); falls back to the custom type's own label ("Transportation
 * Service") with a short id suffix for uniqueness, since a repeatable type
 * with no uid can have many documents that would otherwise all show the
 * same label; falls back to the bare id only if the type's label is
 * somehow unknown (shouldn't happen — schema parity is Phase 0's job).
 */
function buildTitle(doc: { id: string; uid: string | null; type: string }, typeLabels: Map<string, string>): string {
  if (doc.uid) return doc.uid;
  const label = typeLabels.get(doc.type);
  return label ? `${label} (${doc.id.slice(-6)})` : doc.id;
}

/**
 * Two-pass migration, per Phase 2 of the plan:
 *
 * Pass 1 — for every dev document, rewrite asset references (the asset map
 * is already complete from Phase 1) and either create it in sit (new) or,
 * if it was migrated before and dev has since changed, PUT the update.
 * Document-link fields are left holding their *dev* ids — harmless
 * placeholders sit doesn't otherwise recognize — because most targets
 * don't have a sit_id yet on a single forward pass.
 *
 * Pass 2 — now that every dev doc in this run has a sit_id, re-rewrite
 * document-link fields using the now-complete map and PUT any document
 * that actually contains one. Skips a re-fetch by reading back the raw
 * dev document each doc was cached under in Pass 1 (also serves the
 * "don't hold everything in memory" requirement — only ids/hashes are
 * kept in memory between passes, not full documents).
 *
 * A dev document already in the mapping with an unchanged hash is skipped
 * entirely in Pass 1 (nothing to sync) — this is what makes forward-sync
 * safely re-runnable, and what a Phase 4 back-sync "pending" verdict
 * (dev changed independently) resolves into: run this again.
 *
 * One document's write failure does NOT abort the batch — a real run
 * surfaced why this matters: a non-repeatable custom type that already
 * had a document in sit (created outside this tool, so unknown to
 * mapping.json) rejected a create with a 400, and an earlier version of
 * this function let that exception propagate out of the whole
 * `for await` loop, silently abandoning every document after it. Each
 * document's create/update is now its own try/catch; failures are
 * collected and returned rather than thrown, so the run processes
 * everything it can and reports the rest — the caller decides what
 * "halt" means (see cli.ts, which exits non-zero when failures is
 * non-empty).
 */
export async function runPhase2({
  config,
  dryRun,
  fetchImpl = fetch,
}: Phase2Options): Promise<Phase2Result> {
  log("info", "phase2.start", { dryRun });

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    join(config.mappingDir, "asset-mapping.json"),
  );
  const assetMapping = await assetMappingStore.load();
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([devId, entry]) => [devId, entry.sit_asset_id]),
  );

  const devRef = await getMasterRef(config.dev, fetchImpl);
  log("info", "phase2.dev_ref_resolved", {
    repository: config.dev.repository,
    ref: devRef,
  });
  await mkdir(join(config.cacheDir, "dev-docs"), { recursive: true });

  // For a human-readable title on a document that has no uid (see
  // buildTitle below) — a real run surfaced documents whose "Name" in
  // sit's Migration Release list was literally the raw dev document id
  // ("aoWn_hEAAC0AMB8Q"), because that was the fallback here.
  const typeLabels = new Map(
    (await listCustomTypes(config.dev, fetchImpl)).map((t) => [t.id, t.label]),
  );

  let seen = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const failures: Phase2Failure[] = [];

  // ---- Pass 1 ----
  await mappingStore.mutate(async (mapping) => {
    for await (const doc of iterateAllDocuments(config.dev, devRef, fetchImpl)) {
      seen += 1;
      const devHash = canonicalHash(doc.data);
      const existing = mapping[doc.id];

      if (existing && existing.dev_hash === devHash) {
        unchanged += 1;
        continue;
      }

      // Cache the raw doc for Pass 2, regardless of dry-run, so a
      // subsequent real run doesn't need this doc's dry-run output.
      await writeFile(cachePathFor(config.cacheDir, doc.id), JSON.stringify(doc), "utf8");

      const assetRewritten = rewriteRefs(doc.data, { assetIds });

      if (dryRun) {
        log("info", existing ? "phase2.would_update" : "phase2.would_create", {
          devId: doc.id,
          docType: doc.type,
        });
        continue;
      }

      const title = buildTitle(doc, typeLabels);

      try {
        if (existing) {
          await updateMigrationDocument(
            config.sit,
            existing.sit_id,
            { uid: doc.uid || undefined, data: assetRewritten, tags: doc.tags, title },
            fetchImpl,
          );
          mapping[doc.id] = {
            ...existing,
            dev_hash: devHash,
            sit_hash: canonicalHash(assetRewritten),
            status: "pending",
          };
          updated += 1;
          log("info", "phase2.updated", { devId: doc.id, sitId: existing.sit_id });
        } else {
          const created_ = await createMigrationDocument(
            config.sit,
            {
              title,
              type: doc.type,
              uid: doc.uid || undefined,
              lang: doc.lang,
              data: assetRewritten,
              tags: doc.tags,
            },
            fetchImpl,
          );
          mapping[doc.id] = {
            sit_id: created_.id,
            doc_type: doc.type,
            uid: doc.uid || undefined,
            lang: doc.lang,
            dev_hash: devHash,
            sit_hash: canonicalHash(assetRewritten),
            last_synced_at: new Date().toISOString(),
            last_synced_direction: "dev->sit",
            status: "pending",
          };
          created += 1;
          log("info", "phase2.created", { devId: doc.id, sitId: created_.id });
        }
      } catch (err) {
        // Recorded rather than thrown — see the doc comment above
        // runPhase2 for why one document's failure must not abort the
        // rest of the batch. The actual cause (a 4xx's response body) is
        // preserved on the failure entry, same as cli.ts's top-level
        // PrismicApiError handling for an uncaught error elsewhere.
        const operation = existing ? "update" : "create";
        failures.push(toFailure(doc, operation, err));
        log("error", "phase2.write_failed", {
          devId: doc.id,
          docType: doc.type,
          uid: doc.uid,
          lang: doc.lang,
          operation,
        });
      }
    }
    return mapping;
  });

  log("info", "phase2.pass1_done", {
    seen,
    created,
    updated,
    unchanged,
    failed: failures.length,
    dryRun,
  });

  if (seen === 0) {
    // created/updated/unchanged all being 0 is easy to misread as "ran
    // fine, nothing to do" when it actually means dev's document search
    // returned zero results at devRef — check DEV_REPOSITORY, whether
    // DEV_ACCESS_TOKEN is needed (private repo), and whether dev's content
    // is actually published (this only sees the master ref, not drafts).
    log("warn", "phase2.no_dev_documents_found", {
      repository: config.dev.repository,
      ref: devRef,
    });
  }

  if (dryRun) {
    log("warn", "phase2.pass2_skipped_dry_run");
    log("info", "phase2.done", { dryRun });
    return { seen, created, updated, unchanged, linkFixups: 0, failures };
  }

  // ---- Pass 2 ----
  let linkFixups = 0;
  await mappingStore.mutate(async (mapping) => {
    const documentIds = Object.fromEntries(
      Object.entries(mapping).map(([devId, e]) => [devId, e.sit_id]),
    );

    for (const [devId, entry] of Object.entries(mapping)) {
      if (entry.status !== "pending") continue; // only docs this run touched are candidates

      let raw: PrismicDocument;
      try {
        raw = JSON.parse(await readFile(cachePathFor(config.cacheDir, devId), "utf8"));
      } catch {
        // Not written this run (e.g. was already "pending" from a prior
        // crashed run without a cache hit) — nothing to re-fix, leave it.
        continue;
      }

      const fullyRewritten = rewriteRefs(raw.data, { assetIds, documentIds });
      const fullHash = canonicalHash(fullyRewritten);

      if (fullHash === entry.sit_hash) {
        continue; // no document-link fields needed fixing
      }

      // Same resilience as Pass 1: one document's link fix-up failing
      // must not stop every other pending document from being fixed up.
      try {
        await updateMigrationDocument(
          config.sit,
          entry.sit_id,
          { uid: entry.uid, data: fullyRewritten, title: buildTitle(raw, typeLabels) },
          fetchImpl,
        );
        mapping[devId] = { ...entry, sit_hash: fullHash };
        linkFixups += 1;
        log("info", "phase2.link_fixup", { devId, sitId: entry.sit_id });
      } catch (err) {
        failures.push(toFailure({ id: devId, type: entry.doc_type }, "link_fixup", err));
        log("error", "phase2.link_fixup_failed", {
          devId,
          sitId: entry.sit_id,
          docType: entry.doc_type,
        });
      }
    }
    return mapping;
  });

  log("info", "phase2.pass2_done", { linkFixups, failed: failures.length });
  log("info", "phase2.done", { dryRun, totalFailures: failures.length });
  return { seen, created, updated, unchanged, linkFixups, failures };
}
