import { describe, expect, it } from "vitest";
import {
  requireDirection,
  resolveNextHop,
  resolvePair,
} from "../src/lib/environments.js";
import type { Config, RepoConfig } from "../src/config.js";

function repo(name: string): RepoConfig {
  return { repository: `${name}-repo`, migrationToken: `${name}-token` };
}

function config(): Config {
  return {
    environments: {
      dev: repo("dev"),
      sit: repo("sit"),
      uat: repo("uat"),
      prod: repo("prod"),
    },
    environmentChain: ["dev", "sit", "uat", "prod"],
    mappingDir: "./data",
    snapshotDir: "./snapshots",
    reportDir: "./reports",
    cacheDir: "./.cache",
  };
}

describe("resolvePair", () => {
  it("resolves an adjacent forward pair (--from lower, --to upper)", () => {
    const pair = resolvePair(config(), "dev", "sit");
    expect(pair.direction).toBe("forward");
    expect(pair.lowerName).toBe("dev");
    expect(pair.upperName).toBe("sit");
    expect(pair.from.repository).toBe("dev-repo");
    expect(pair.to.repository).toBe("sit-repo");
  });

  it("resolves an adjacent backward pair (--from upper, --to lower) with the same lower/upper", () => {
    const pair = resolvePair(config(), "uat", "sit");
    expect(pair.direction).toBe("backward");
    expect(pair.lowerName).toBe("sit");
    expect(pair.upperName).toBe("uat");
    // Same lower/upper as the forward call for this pair — the mapping
    // file identity is direction-independent.
    const forward = resolvePair(config(), "sit", "uat");
    expect(pair.lowerName).toBe(forward.lowerName);
    expect(pair.upperName).toBe(forward.upperName);
  });

  it("rejects a non-adjacent pair (skip-tier)", () => {
    expect(() => resolvePair(config(), "dev", "uat")).toThrow(/not adjacent/);
    expect(() => resolvePair(config(), "dev", "prod")).toThrow(/not adjacent/);
  });

  it("rejects an environment not in the configured chain", () => {
    expect(() => resolvePair(config(), "dev", "staging")).toThrow(
      /not part of the configured environment chain/,
    );
  });

  it("rejects an environment in the chain but not configured (missing env vars)", () => {
    const cfg = config();
    delete cfg.environments.prod;
    expect(() => resolvePair(cfg, "uat", "prod")).toThrow(/not configured/);
  });

  it("rejects identical --from and --to", () => {
    expect(() => resolvePair(config(), "dev", "dev")).toThrow(/must be different/);
  });
});

describe("resolveNextHop", () => {
  it("resolves a single hop as itself, marked final", () => {
    const { pair, isFinalHop } = resolveNextHop(config(), "dev", "sit");
    expect(pair.lowerName).toBe("dev");
    expect(pair.upperName).toBe("sit");
    expect(isFinalHop).toBe(true);
  });

  it("resolves a multi-hop promotion to its first hop only, marked non-final", () => {
    const { pair, isFinalHop } = resolveNextHop(config(), "dev", "prod");
    expect(pair.lowerName).toBe("dev");
    expect(pair.upperName).toBe("sit");
    expect(isFinalHop).toBe(false);
  });

  it("resolves the middle hop of a multi-hop promotion once continued from there", () => {
    const { pair, isFinalHop } = resolveNextHop(config(), "sit", "prod");
    expect(pair.lowerName).toBe("sit");
    expect(pair.upperName).toBe("uat");
    expect(isFinalHop).toBe(false);
  });

  it("rejects a backward promotion", () => {
    expect(() => resolveNextHop(config(), "sit", "dev")).toThrow(
      /only moves up the chain/,
    );
  });

  it("rejects identical --from and --to", () => {
    expect(() => resolveNextHop(config(), "dev", "dev")).toThrow(/must be different/);
  });

  it("rejects an environment not in the configured chain", () => {
    expect(() => resolveNextHop(config(), "dev", "staging")).toThrow(
      /not part of the configured environment chain/,
    );
  });

  it("rejects when the immediate next hop's environment isn't configured", () => {
    const cfg = config();
    delete cfg.environments.sit;
    expect(() => resolveNextHop(cfg, "dev", "prod")).toThrow(/not configured/);
  });
});

describe("requireDirection", () => {
  it("passes silently when direction matches", () => {
    const pair = resolvePair(config(), "dev", "sit");
    expect(() => requireDirection(pair, "forward", "migrate")).not.toThrow();
  });

  it("throws with a clear message when direction is reversed", () => {
    const pair = resolvePair(config(), "sit", "dev"); // backward
    expect(() => requireDirection(pair, "forward", "migrate")).toThrow(
      /migrate only promotes/,
    );
  });

  it("points at the opposite command in the error message", () => {
    const pair = resolvePair(config(), "sit", "dev"); // backward
    try {
      requireDirection(pair, "forward", "migrate");
      throw new Error("expected requireDirection to throw");
    } catch (err) {
      expect(String(err)).toMatch(/Use backsync for that direction instead/);
    }
  });
});
