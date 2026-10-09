import Redis from "ioredis";

import { oidcConfig } from "./config";
import { rand } from "./oidc";

/** Everything kept server side for a logged-in user. Never sent to the browser. */
export type Session = {
  sub: string;
  email?: string;
  name?: string;
  sid?: string; // vendor session id, used for back-channel logout
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  accessExp: number; // epoch seconds
  createdAt: number; // epoch seconds
};

export interface SessionStore {
  /** Stores a new session under a fresh random id (never reuse an id from before login). */
  create(data: Session): Promise<string>;
  get(id: string): Promise<Session | null>;
  /** Replaces a session and restarts its TTL. */
  save(id: string, data: Session): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByVendorSid(sid: string): Promise<void>;
  deleteBySub(sub: string): Promise<void>;
  /** Short lock so only one request refreshes a rotating refresh token. */
  tryLock(name: string, ttlSeconds: number): Promise<boolean>;
  unlock(name: string): Promise<void>;
}

const sessKey = (id: string) => `sess:${id}`;
const sidKey = (sid: string) => `vsid:${sid}`;
const subKey = (sub: string) => `vsub:${sub}`;
const lockKey = (name: string) => `lock:${name}`;

// ----------------------------------------------------------------- Redis
// The subset of the ioredis client we use, so tests can pass ioredis-mock.
export type RedisLike = Pick<
  Redis,
  "set" | "get" | "del" | "sadd" | "srem" | "smembers" | "expire"
>;

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly ttl: () => number = () => oidcConfig().sessionTtl,
  ) {}

  async create(data: Session): Promise<string> {
    const id = rand();
    await this.save(id, data);
    return id;
  }

  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.get(sessKey(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async save(id: string, data: Session): Promise<void> {
    await this.redis.set(sessKey(id), JSON.stringify(data), "EX", this.ttl());
    // Indexes for back-channel logout, kept at least as long as the session.
    if (data.sid) {
      await this.redis.sadd(sidKey(data.sid), id);
      await this.redis.expire(sidKey(data.sid), oidcConfig().sessionMaxAge);
    }
    await this.redis.sadd(subKey(data.sub), id);
    await this.redis.expire(subKey(data.sub), oidcConfig().sessionMaxAge);
  }

  async delete(id: string): Promise<void> {
    const s = await this.get(id);
    await this.redis.del(sessKey(id));
    if (s?.sid) await this.redis.srem(sidKey(s.sid), id);
    if (s) await this.redis.srem(subKey(s.sub), id);
  }

  private async deleteSet(setKey: string) {
    const ids = await this.redis.smembers(setKey);
    if (ids.length) await this.redis.del(...ids.map(sessKey));
    await this.redis.del(setKey);
  }

  deleteByVendorSid(sid: string) {
    return this.deleteSet(sidKey(sid));
  }

  deleteBySub(sub: string) {
    return this.deleteSet(subKey(sub));
  }

  async tryLock(name: string, ttlSeconds: number): Promise<boolean> {
    return (await this.redis.set(lockKey(name), "1", "EX", ttlSeconds, "NX")) === "OK";
  }

  async unlock(name: string): Promise<void> {
    await this.redis.del(lockKey(name));
  }
}

// ---------------------------------------------------------------- memory
// Development fallback only (no REDIS_URL): one process, lost on restart, not
// shared between instances. getSessionStore() refuses it in production.
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, { data: Session; expires: number }>();
  private locks = new Map<string, number>();

  constructor(private readonly ttl: () => number = () => oidcConfig().sessionTtl) {}

  private alive(id: string) {
    const e = this.sessions.get(id);
    if (!e) return null;
    if (e.expires <= Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    return e;
  }

  async create(data: Session): Promise<string> {
    const id = rand();
    await this.save(id, data);
    return id;
  }

  async get(id: string): Promise<Session | null> {
    return this.alive(id)?.data ?? null;
  }

  async save(id: string, data: Session): Promise<void> {
    this.sessions.set(id, { data, expires: Date.now() + this.ttl() * 1000 });
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  private deleteWhere(pred: (s: Session) => boolean) {
    for (const [id, e] of this.sessions) if (pred(e.data)) this.sessions.delete(id);
  }

  async deleteByVendorSid(sid: string): Promise<void> {
    this.deleteWhere((s) => s.sid === sid);
  }

  async deleteBySub(sub: string): Promise<void> {
    this.deleteWhere((s) => s.sub === sub);
  }

  async tryLock(name: string, ttlSeconds: number): Promise<boolean> {
    const until = this.locks.get(name);
    if (until && until > Date.now()) return false;
    this.locks.set(name, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async unlock(name: string): Promise<void> {
    this.locks.delete(name);
  }
}

// --------------------------------------------------------------- selection
// Kept on globalThis so Next's dev-mode module reloads do not drop the
// sessions (memory) or open a new Redis connection on every reload.
const g = globalThis as unknown as { __oidcSessionStore?: SessionStore };

export function getSessionStore(): SessionStore {
  if (g.__oidcSessionStore) return g.__oidcSessionStore;

  const url = process.env.REDIS_URL;
  if (url) {
    // Created lazily: a build must never need a Redis connection.
    g.__oidcSessionStore = new RedisSessionStore(new Redis(url));
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "REDIS_URL is required in production: sessions must be shared across instances",
    );
  } else {
    console.warn("[oidc] REDIS_URL not set: using in-memory sessions (development only)");
    g.__oidcSessionStore = new MemorySessionStore();
  }
  return g.__oidcSessionStore;
}

/** For tests: install (or clear, with undefined) the store used by getSessionStore(). */
export function setSessionStoreForTests(store: SessionStore | undefined) {
  g.__oidcSessionStore = store;
}
