// @vitest-environment node
import RedisMock from "ioredis-mock";
import { describe, expect, it, beforeEach } from "vitest";

import {
  MemorySessionStore,
  RedisSessionStore,
  getSessionStore,
  setSessionStoreForTests,
  type Session,
  type SessionStore,
} from "./session-store";

const session = (over: Partial<Session> = {}): Session => ({
  sub: "user-1",
  email: "a@example.com",
  name: "A",
  sid: "vendor-sid-1",
  idToken: "id.token.x",
  accessToken: "access.token.x",
  refreshToken: "refresh-1",
  accessExp: 2_000_000_000,
  createdAt: 1_700_000_000,
  ...over,
});

// The same behaviour is required of both implementations.
const implementations: Array<[string, () => SessionStore]> = [
  ["MemorySessionStore", () => new MemorySessionStore(() => 3600)],
  [
    "RedisSessionStore (ioredis-mock)",
    () =>
      new RedisSessionStore(new (RedisMock as unknown as new () => never)(), () => 3600),
  ],
];

describe.each(implementations)("%s", (_name, make) => {
  let store: SessionStore;
  beforeEach(() => {
    store = make();
  });

  it("creates a session under a fresh random id and reads it back", async () => {
    const a = await store.create(session());
    const b = await store.create(session());
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await store.get(a)).toEqual(session());
  });

  it("returns null for an unknown or forged id", async () => {
    expect(await store.get("nope")).toBeNull();
  });

  it("save() replaces the stored session", async () => {
    const id = await store.create(session());
    await store.save(id, session({ accessToken: "new", accessExp: 5 }));
    expect((await store.get(id))?.accessToken).toBe("new");
  });

  it("delete() removes the session", async () => {
    const id = await store.create(session());
    await store.delete(id);
    expect(await store.get(id)).toBeNull();
  });

  it("deleteByVendorSid() removes every session of that vendor session only", async () => {
    const a = await store.create(session({ sid: "S1" }));
    const b = await store.create(session({ sid: "S1" }));
    const c = await store.create(session({ sid: "S2" }));
    await store.deleteByVendorSid("S1");
    expect(await store.get(a)).toBeNull();
    expect(await store.get(b)).toBeNull();
    expect(await store.get(c)).not.toBeNull();
  });

  it("deleteBySub() removes every session of that user only", async () => {
    const a = await store.create(session({ sub: "u1", sid: undefined }));
    const b = await store.create(session({ sub: "u1", sid: "other" }));
    const c = await store.create(session({ sub: "u2", sid: undefined }));
    await store.deleteBySub("u1");
    expect(await store.get(a)).toBeNull();
    expect(await store.get(b)).toBeNull();
    expect(await store.get(c)).not.toBeNull();
  });

  it("only one caller gets the refresh lock until it is released", async () => {
    expect(await store.tryLock("refresh:x", 10)).toBe(true);
    expect(await store.tryLock("refresh:x", 10)).toBe(false);
    await store.unlock("refresh:x");
    expect(await store.tryLock("refresh:x", 10)).toBe(true);
  });
});

describe("MemorySessionStore expiry", () => {
  it("drops a session after its TTL", async () => {
    const store = new MemorySessionStore(() => 0.05); // 50 ms
    const id = await store.create(session());
    expect(await store.get(id)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 80));
    expect(await store.get(id)).toBeNull();
  });

  it("lock expires after its TTL", async () => {
    const store = new MemorySessionStore();
    expect(await store.tryLock("l", 0.05)).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(await store.tryLock("l", 10)).toBe(true);
  });
});

describe("getSessionStore", () => {
  it("refuses the in-memory fallback in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const keep = { node: env.NODE_ENV, redis: env.REDIS_URL };
    setSessionStoreForTests(undefined);
    try {
      env.NODE_ENV = "production";
      delete env.REDIS_URL;
      expect(() => getSessionStore()).toThrow(/REDIS_URL is required in production/);
    } finally {
      env.NODE_ENV = keep.node;
      if (keep.redis) env.REDIS_URL = keep.redis;
      setSessionStoreForTests(undefined);
    }
  });

  it("falls back to memory outside production when REDIS_URL is unset", () => {
    const env = process.env as Record<string, string | undefined>;
    const keep = { node: env.NODE_ENV, redis: env.REDIS_URL };
    setSessionStoreForTests(undefined);
    try {
      env.NODE_ENV = "test";
      delete env.REDIS_URL;
      expect(getSessionStore()).toBeInstanceOf(MemorySessionStore);
      expect(getSessionStore()).toBe(getSessionStore()); // cached
    } finally {
      env.NODE_ENV = keep.node;
      if (keep.redis) env.REDIS_URL = keep.redis;
      setSessionStoreForTests(undefined);
    }
  });
});
