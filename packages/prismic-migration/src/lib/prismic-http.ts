import type { RepoConfig } from "../config.js";
import type { PrismicAsset, PrismicCustomType, PrismicDocument } from "../types.js";
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

async function request(
  url: string,
  init: RequestInit,
  fetchImpl: FetchFn,
): Promise<Response> {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PrismicApiError(
      `${init.method || "GET"} ${url} -> ${response.status}`,
      response.status,
      body,
    );
  }
  return response;
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
  url.searchParams.set("q", `[[at(document.id,"${id}")]]`);
  if (repo.accessToken) url.searchParams.set("access_token", repo.accessToken);

  const res = await request(url.toString(), {}, fetchImpl);
  const body = (await res.json()) as SearchResponse;
  return body.results[0] ?? null;
}
