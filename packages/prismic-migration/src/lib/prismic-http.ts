import type { RepoConfig } from "../config.js";
import type { PrismicAsset, PrismicCustomType, PrismicDocument } from "../types.js";
import { log } from "./logger.js";
import { createRateLimiter } from "./rate-limit.js";

const MIGRATION_API = "https://migration.prismic.io";
const ASSET_API = "https://asset-api.prismic.io";
const CUSTOM_TYPES_API = "https://customtypes.prismic.io";

// The Migration API is documented as limited to one request per second per
// repository. Every migration-document write in this file is routed
// through this one shared limiter, so callers never have to think about
// spacing requests themselves.
const migrationLimiter = createRateLimiter(1000);

export class PrismicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "PrismicApiError";
  }
}

type FetchFn = typeof fetch;

// The Migration API's documented "1 req/sec" limit is not the only rate
// limit Prismic enforces — the Asset API's list endpoint, in particular,
// has been observed (real run, real repository) rejecting a plain
// paginated GET loop with 429 even without the migration limiter's help.
// So every request through this module retries on 429 and on transient
// 502/503/504 gateway errors, not just the endpoints known in advance to
// need it — a single rate-limit response should never abort a whole run.
const MAX_RETRIES = 5;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  // Exponential backoff with jitter, capped at 10s, when the server didn't
  // tell us how long to wait.
  const base = Math.min(500 * 2 ** attempt, 10_000);
  return base + Math.random() * 250;
}

async function request(
  url: string,
  init: RequestInit,
  fetchImpl: FetchFn,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(url, init);

    if (response.ok) return response;

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const delay = retryDelayMs(response, attempt);
      log("warn", "prismic_http.retrying", {
        url,
        status: response.status,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        delayMs: Math.round(delay),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const body = await response.text().catch(() => "");
    throw new PrismicApiError(
      `${init.method || "GET"} ${url} -> ${response.status}`,
      response.status,
      body,
    );
  }
}

// ---- Custom Types API ----
// https://customtypes.prismic.io — repository + Bearer token headers.

export async function listCustomTypes(
  repo: RepoConfig,
  fetchImpl: FetchFn = fetch,
): Promise<PrismicCustomType[]> {
  const res = await request(
    `${CUSTOM_TYPES_API}/customtypes`,
    {
      headers: {
        repository: repo.repository,
        Authorization: `Bearer ${repo.migrationToken}`,
      },
    },
    fetchImpl,
  );
  return (await res.json()) as PrismicCustomType[];
}

export async function insertCustomType(
  repo: RepoConfig,
  customType: PrismicCustomType,
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  await request(
    `${CUSTOM_TYPES_API}/customtypes/insert`,
    {
      method: "POST",
      headers: {
        repository: repo.repository,
        Authorization: `Bearer ${repo.migrationToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customType),
    },
    fetchImpl,
  );
}

export async function updateCustomType(
  repo: RepoConfig,
  customType: PrismicCustomType,
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  await request(
    `${CUSTOM_TYPES_API}/customtypes/update`,
    {
      method: "POST",
      headers: {
        repository: repo.repository,
        Authorization: `Bearer ${repo.migrationToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customType),
    },
    fetchImpl,
  );
}

// ---- Asset API ----
// https://asset-api.prismic.io — repository + Bearer token headers.

export async function listAssets(
  repo: RepoConfig,
  fetchImpl: FetchFn = fetch,
): Promise<PrismicAsset[]> {
  const assets: PrismicAsset[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${ASSET_API}/assets`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await request(
      url.toString(),
      {
        headers: {
          repository: repo.repository,
          Authorization: `Bearer ${repo.migrationToken}`,
        },
      },
      fetchImpl,
    );
    const page = (await res.json()) as { items: PrismicAsset[]; cursor?: string };
    assets.push(...page.items);
    cursor = page.cursor;
  } while (cursor);

  return assets;
}

export async function uploadAsset(
  repo: RepoConfig,
  file: Blob,
  filename: string,
  fetchImpl: FetchFn = fetch,
): Promise<PrismicAsset> {
  const form = new FormData();
  form.append("file", file, filename);

  const res = await request(
    `${ASSET_API}/assets`,
    {
      method: "POST",
      headers: {
        repository: repo.repository,
        Authorization: `Bearer ${repo.migrationToken}`,
      },
      body: form,
    },
    fetchImpl,
  );
  return (await res.json()) as PrismicAsset;
}

// ---- Migration API (documents) ----
// https://migration.prismic.io — repository header + Authorization header.
//
// VERIFY BEFORE FIRST REAL RUN: Prismic's own technical reference documents
// this header only as "Authorization: a permanent token", without showing
// a literal example. `Bearer <token>` is used here for consistency with
// the Asset and Custom Types APIs (both explicitly documented as Bearer) —
// confirm against the code sample Prismic's own dashboard generates for
// your repository before relying on this in production.

export type MigrationDocumentBody = {
  title: string;
  type: string;
  uid?: string;
  lang: string;
  data: Record<string, unknown>;
  tags?: string[];
};

export async function createMigrationDocument(
  repo: RepoConfig,
  body: MigrationDocumentBody,
  fetchImpl: FetchFn = fetch,
): Promise<{ id: string }> {
  return migrationLimiter(async () => {
    const res = await request(
      `${MIGRATION_API}/documents`,
      {
        method: "POST",
        headers: {
          repository: repo.repository,
          Authorization: `Bearer ${repo.migrationToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      fetchImpl,
    );
    return (await res.json()) as { id: string };
  });
}

export type MigrationDocumentUpdate = {
  uid?: string;
  data: Record<string, unknown>;
  tags?: string[];
  // UNVERIFIED: Prismic's technical reference lists `uid` and `data` as the
  // PUT body's meaningful fields, and explicitly calls out `type`/`lang`/
  // `alternate_language_id` as ignored on update — it says nothing either
  // way about `title`. Included so a re-sync CAN correct a bad title
  // picked up at create time; confirm in the dashboard after a real PUT
  // whether it actually took effect before relying on this to fix titles
  // in bulk.
  title?: string;
};

export async function updateMigrationDocument(
  repo: RepoConfig,
  id: string,
  body: MigrationDocumentUpdate,
  fetchImpl: FetchFn = fetch,
): Promise<void> {
  await migrationLimiter(async () => {
    await request(
      `${MIGRATION_API}/documents/${id}/`,
      {
        method: "PUT",
        headers: {
          repository: repo.repository,
          Authorization: `Bearer ${repo.migrationToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      fetchImpl,
    );
  });
}

// ---- Content API v2 (reads of published content) ----

type ApiV2Root = { refs: { ref: string; isMasterRef: boolean }[] };

export async function getMasterRef(
  repo: RepoConfig,
  fetchImpl: FetchFn = fetch,
): Promise<string> {
  const url = new URL(`https://${repo.repository}.cdn.prismic.io/api/v2`);
  if (repo.accessToken) url.searchParams.set("access_token", repo.accessToken);

  const res = await request(url.toString(), {}, fetchImpl);
  const root = (await res.json()) as ApiV2Root;
  const master = root.refs.find((r) => r.isMasterRef);
  if (!master) throw new Error(`No master ref found for repository ${repo.repository}`);
  return master.ref;
}

type SearchResponse = { results: PrismicDocument[]; next_page: string | null };

/**
 * Fetches every document currently visible at `ref`, one page at a time —
 * deliberately a generator rather than a "get everything" function, so a
 * large repository is never held fully in memory at once (Phase 2's own
 * requirement).
 */
export async function* iterateAllDocuments(
  repo: RepoConfig,
  ref: string,
  fetchImpl: FetchFn = fetch,
): AsyncGenerator<PrismicDocument> {
  let page = 1;
  for (;;) {
    const url = new URL(
      `https://${repo.repository}.cdn.prismic.io/api/v2/documents/search`,
    );
    url.searchParams.set("ref", ref);
    // Without an explicit `lang`, Prismic's content API restricts results
    // to the repository's master locale only — a multi-locale repository
    // with content outside that locale silently returns zero documents,
    // no error. `*` fetches every locale, which is what a full migration
    // needs. (Confirmed against a real repository: an unfiltered query
    // returned 0 documents despite 49 assets existing and no auth error.)
    url.searchParams.set("lang", "*");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("page", String(page));
    if (repo.accessToken) url.searchParams.set("access_token", repo.accessToken);

    const res = await request(url.toString(), {}, fetchImpl);
    const body = (await res.json()) as SearchResponse;
    for (const doc of body.results) yield doc;

    if (!body.next_page) return;
    page += 1;
  }
}

export async function getDocumentById(
  repo: RepoConfig,
  ref: string,
  id: string,
  fetchImpl: FetchFn = fetch,
): Promise<PrismicDocument | null> {
  const url = new URL(
    `https://${repo.repository}.cdn.prismic.io/api/v2/documents/search`,
  );
  url.searchParams.set("ref", ref);
  url.searchParams.set("lang", "*"); // see iterateAllDocuments — same reasoning
  url.searchParams.set("q", `[[at(document.id,"${id}")]]`);
  if (repo.accessToken) url.searchParams.set("access_token", repo.accessToken);

  const res = await request(url.toString(), {}, fetchImpl);
  const body = (await res.json()) as SearchResponse;
  return body.results[0] ?? null;
}

/**
 * Documents of a given custom type at `ref`, optionally narrowed to one
 * locale. Used by the `reconcile` command to find a pre-existing sit
 * document for a non-repeatable type (one created outside this tool, so
 * mapping.json never recorded it) — `pageSize` is small on purpose: this
 * only needs to tell "zero", "one", or "more than one" apart, never a
 * full listing.
 *
 * The `lang` filter matters more than it looks: a real run showed a
 * non-repeatable type with one document PER LOCALE (5+ languages) —
 * type-only matching found all of them at once (an unhelpful "6 matches"
 * instead of the one that actually corresponds to a given dev document's
 * locale). Pass `lang` whenever the caller has one to disambiguate.
 */
export async function findDocumentsByType(
  repo: RepoConfig,
  ref: string,
  type: string,
  lang?: string,
  fetchImpl: FetchFn = fetch,
): Promise<PrismicDocument[]> {
  const url = new URL(`https://${repo.repository}.cdn.prismic.io/api/v2/documents/search`);
  url.searchParams.set("ref", ref);
  // Locale is controlled by the `lang` QUERY PARAMETER, not a predicate —
  // confirmed by a real 400 ("unexpected field 'document.lang'") when
  // `at(document.lang, ...)` was tried as an `at()` predicate. `*` means
  // every locale; a specific locale narrows to just that one. So a
  // caller-supplied `lang` sets this param directly instead of adding a
  // second predicate to `q`.
  url.searchParams.set("lang", lang || "*");
  const q = `[[at(document.type,"${type}")]]`;
  url.searchParams.set("q", q);
  // Logged unconditionally (not just on failure) — some terminal/tooling
  // setups have been observed truncating the request URL in error output,
  // so this is a second, independent way to see exactly what query was
  // sent when diagnosing a 400 here.
  log("info", "prismic_http.find_documents_by_type_query", { repository: repo.repository, type, lang, q });
  url.searchParams.set("pageSize", "20");
  if (repo.accessToken) url.searchParams.set("access_token", repo.accessToken);

  const res = await request(url.toString(), {}, fetchImpl);
  const body = (await res.json()) as SearchResponse;
  return body.results;
}
