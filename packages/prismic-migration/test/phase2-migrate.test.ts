import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPhase2 } from "../src/phases/phase2-migrate.js";
import type { Config } from "../src/config.js";

// Regression coverage for a real-run confusion: created/updated/unchanged
// all being 0 looked like "nothing to do" when it actually meant dev's
// document search returned zero results — indistinguishable from a
// healthy no-op run without reading the code. phase2 now logs a `seen`
// count and an explicit warning event when it's 0.

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fakeMasterRefResponse(): Response {
  return jsonResponse({ refs: [{ ref: "master-ref", isMasterRef: true }] });
}

describe("runPhase2 — dev document search returns nothing", () => {
  let dir: string;
  let config: Config;
  let logs: { level: string; event: string; fields: Record<string, unknown> }[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phase2-"));
    config = {
      dev: { repository: "dev-repo", migrationToken: "dev-token" },
      sit: { repository: "sit-repo", migrationToken: "sit-token" },
      mappingDir: join(dir, "data"),
      snapshotDir: join(dir, "snapshots"),
      reportDir: join(dir, "reports"),
      cacheDir: join(dir, "cache"),
    };
    logs = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      const parsed = JSON.parse(line);
      logs.push({ level: parsed.level, event: parsed.event, fields: parsed });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("logs seen: 0 and a no_dev_documents_found warning, rather than looking like a healthy no-op", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/api/v2") return fakeMasterRefResponse();
      if (url.pathname === "/customtypes") return jsonResponse([]);
      if (url.pathname === "/api/v2/documents/search") {
        return jsonResponse({ results: [], next_page: null });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    });

    await runPhase2({ config, dryRun: false, fetchImpl });

    const pass1Done = logs.find((l) => l.event === "phase2.pass1_done");
    expect(pass1Done?.fields).toMatchObject({
      seen: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
    });

    const warning = logs.find((l) => l.event === "phase2.no_dev_documents_found");
    expect(warning).toBeDefined();
    expect(warning?.level).toBe("warn");
    expect(warning?.fields).toMatchObject({ repository: "dev-repo", ref: "master-ref" });
  });

  it("does not warn when dev documents are actually found", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      if (url.pathname === "/api/v2") return fakeMasterRefResponse();
      if (url.pathname === "/customtypes") return jsonResponse([]);
      if (url.pathname === "/api/v2/documents/search") {
        return jsonResponse({
          results: [
            {
              id: "dev-doc-1",
              uid: "home",
              type: "page",
              lang: "en-us",
              tags: [],
              data: {},
            },
          ],
          next_page: null,
        });
      }
      if (url.pathname === "/documents") {
        return jsonResponse({ id: "sit-doc-1" });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    });

    await runPhase2({ config, dryRun: false, fetchImpl });

    expect(logs.find((l) => l.event === "phase2.no_dev_documents_found")).toBeUndefined();
    const pass1Done = logs.find((l) => l.event === "phase2.pass1_done");
    expect(pass1Done?.fields).toMatchObject({ seen: 1, created: 1 });
  });
});
