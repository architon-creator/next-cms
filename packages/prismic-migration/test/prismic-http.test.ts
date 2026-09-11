import { describe, expect, it, vi } from "vitest";
import {
  createMigrationDocument,
  listCustomTypes,
  uploadAsset,
} from "../src/lib/prismic-http.js";
import type { RepoConfig } from "../src/config.js";

const repo: RepoConfig = { repository: "my-repo", migrationToken: "write-token" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createMigrationDocument", () => {
  it("POSTs to the Migration API with the documented headers and body shape", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "sit-doc-1" }));

    const result = await createMigrationDocument(
      repo,
      {
        title: "Home",
        type: "homepage",
        uid: "home",
        lang: "en-us",
        data: { title: "Home" },
      },
      fetchImpl,
    );

    expect(result).toEqual({ id: "sit-doc-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://migration.prismic.io/documents");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      repository: "my-repo",
      Authorization: "Bearer write-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Home",
      type: "homepage",
      uid: "home",
      lang: "en-us",
      data: { title: "Home" },
    });
  });

  it("throws PrismicApiError with the response status/body on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad token", { status: 401 }));
    await expect(
      createMigrationDocument(
        repo,
        { title: "Home", type: "homepage", lang: "en-us", data: {} },
        fetchImpl,
      ),
    ).rejects.toMatchObject({ name: "PrismicApiError", status: 401 });
  });
});

describe("uploadAsset", () => {
  it("POSTs multipart form data with the file under the 'file' field", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "sit-asset-1" }));
    const blob = new Blob(["fake-bytes"], { type: "image/png" });

    const result = await uploadAsset(repo, blob, "hero.png", fetchImpl);

    expect(result).toEqual({ id: "sit-asset-1" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://asset-api.prismic.io/assets");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      repository: "my-repo",
      Authorization: "Bearer write-token",
    });
    expect(init.body).toBeInstanceOf(FormData);
    const uploadedFile = (init.body as FormData).get("file") as File;
    expect(uploadedFile.name).toBe("hero.png");
  });
});

// Regression coverage for a real-run failure: a plain paginated GET loop
// against the Asset API was observed hitting 429, and — before this retry
// logic existed — that aborted the entire run on the very first page.
describe("retry on 429 / transient gateway errors", () => {
  it("retries a 429 and succeeds once the server allows it, honoring Retry-After", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    const result = await listCustomTypes(repo, fetchImpl);

    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries 502/503/504 the same way as 429", async () => {
    for (const status of [502, 503, 504]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("bad gateway", { status, headers: { "retry-after": "0" } }),
        )
        .mockResolvedValueOnce(jsonResponse([]));

      await expect(listCustomTypes(repo, fetchImpl)).resolves.toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("gives up after the retry budget and throws PrismicApiError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response("still limited", { status: 429, headers: { "retry-after": "0" } }),
      );

    await expect(listCustomTypes(repo, fetchImpl)).rejects.toMatchObject({
      name: "PrismicApiError",
      status: 429,
    });
    // 1 initial attempt + 5 retries = 6 calls before giving up.
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("does not retry a non-retryable status like 401", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad token", { status: 401 }));
    await expect(listCustomTypes(repo, fetchImpl)).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

// Regression coverage for the "no request timeout" known gap: a request
// against an unreachable/black-holing host used to hang indefinitely.
// Simulates that by having the mock fetch never resolve on its own,
// relying entirely on the AbortSignal request() now passes in — exactly
// what a real fetch implementation does when its signal fires.
describe("request timeout", () => {
  function hangingFetch() {
    return vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
  }

  it("gives up after the retry budget and throws a clear timeout error, not PrismicApiError", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = hangingFetch();
      const promise = listCustomTypes(repo, fetchImpl);
      const assertion = expect(promise).rejects.toThrow(/timed out after/);
      // Advance well past the default timeout for every attempt (initial +
      // MAX_RETRIES retries) and every backoff delay between them.
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(40_000);
      }
      await assertion;
      await expect(promise).rejects.not.toMatchObject({ name: "PrismicApiError" });
      // 1 initial attempt + 5 retries = 6 calls before giving up — same
      // retry budget as a retryable HTTP status.
      expect(fetchImpl).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers if a later attempt succeeds before hitting the retry budget", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
        calls += 1;
        if (calls < 3) {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted.");
              err.name = "AbortError";
              reject(err);
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      });

      const promise = listCustomTypes(repo, fetchImpl);
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(40_000);
      }
      await expect(promise).resolves.toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry a genuine (non-abort) network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND fake-repo.cdn.prismic.io");
    });
    await expect(listCustomTypes(repo, fetchImpl)).rejects.toThrow(/ENOTFOUND/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
