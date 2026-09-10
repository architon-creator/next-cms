import { describe, expect, it, vi } from "vitest";
import { createMigrationDocument, uploadAsset } from "../src/lib/prismic-http.js";
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
