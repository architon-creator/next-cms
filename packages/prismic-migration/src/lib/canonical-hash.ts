import { createHash } from "node:crypto";

/**
 * Deep, key-order-independent JSON stringification. Two payloads that are
 * structurally identical but were serialized with keys in a different
 * order — which nothing guarantees Prismic's API won't do across two
 * requests — canonicalize to the same string, and therefore hash the same.
 * Without this, every hash-based rule in this toolkit (rule #1: never
 * overwrite without a hash comparison) is unreliable.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 of a value's canonical JSON form. This is the single hashing
 * function used everywhere in this toolkit — mapping entries, spot-checks,
 * and conflict detection all call this one function, so "the same
 * document" always produces "the same hash" no matter which code path
 * computed it.
 */
export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}
