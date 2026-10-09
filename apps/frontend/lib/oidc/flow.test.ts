// @vitest-environment node
//
// End-to-end test of the login flow WITHOUT a running Next server: the real route
// handlers are called directly, a test "browser" keeps cookies and follows the
// redirects, the identity provider is the mock IdP (a real HTTP server), and the
// "Java API" is a tiny fake that records what it receives.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest, type NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startMockIdp, type MockIdp } from "../../scripts/mock-idp.mjs";

// next/headers' cookies() only works inside a real request: serve it from the test browser's jar.
const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string> }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name in jar.cookies ? { name, value: jar.cookies[name] } : undefined,
  }),
}));

import { GET as callbackGET } from "@/app/auth/callback/route";
import { POST as backchannelPOST } from "@/app/auth/backchannel-logout/route";
import { GET as loginGET } from "@/app/auth/login/route";
import { GET as sessionGET } from "@/app/auth/session/route";
import { POST as logoutPOST } from "@/app/auth/logout/route";
import { GET as proxyGET, POST as proxyPOST } from "@/app/api/ibe/[...path]/route";
import { currentSession } from "@/lib/oidc/auth";
import { readLoginState, resetOidcCaches, signLoginState } from "@/lib/oidc/oidc";
import { MemorySessionStore, setSessionStoreForTests } from "@/lib/oidc/session-store";

const APP = "http://localhost:3000";
const REDIRECT = `${APP}/auth/callback`;

let idp: MockIdp;
let java: Server;
let javaUrl: string;
const javaCalls: Array<{
  method: string;
  url: string;
  authorization?: string;
  body: string;
}> = [];
let store: MemorySessionStore;

// ---------------------------------------------------------------- test browser
class Browser {
  cookies = new Map<string, { value: string; path: string }>();

  /** Stores Set-Cookie results of a route handler's response. */
  absorb(res: NextResponse | Response) {
    const set = (res as NextResponse).cookies?.getAll() ?? [];
    for (const c of set) {
      const gone = c.value === "" || c.maxAge === 0;
      if (gone) this.cookies.delete(c.name);
      else this.cookies.set(c.name, { value: c.value, path: c.path ?? "/" });
    }
    this.sync();
  }

  /** What next/headers cookies() will see in server code (path "/" cookies). */
  sync() {
    jar.cookies = {};
    for (const [name, c] of this.cookies) jar.cookies[name] = c.value;
  }

  headerFor(path: string) {
    return [...this.cookies]
      .filter(([, c]) => path.startsWith(c.path))
      .map(([n, c]) => `${n}=${c.value}`)
      .join("; ");
  }

  req(
    url: string,
    init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {},
  ) {
    const path = new URL(url).pathname;
    const cookie = this.headerFor(path);
    return new NextRequest(url, {
      ...init,
      headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
    });
  }
}

/** Runs login -> IdP -> callback. Returns the browser plus every step's response. */
async function login(browser: Browser, returnTo = "/booking") {
  const loginRes = await loginGET(
    browser.req(`${APP}/auth/login?returnTo=${encodeURIComponent(returnTo)}`),
  );
  browser.absorb(loginRes);
  const authorizeUrl = loginRes.headers.get("location")!;
  const idpRes = await fetch(authorizeUrl, { redirect: "manual" }); // the IdP login page + MFA, auto-approved
  const callbackUrl = idpRes.headers.get("location")!;
  const callbackRes = await callbackGET(browser.req(callbackUrl));
  browser.absorb(callbackRes);
  return { loginRes, authorizeUrl, callbackUrl, callbackRes };
}

const sessionIdOf = (b: Browser) => b.cookies.get("ibe_session")?.value;

// ------------------------------------------------------------------- set up
beforeAll(async () => {
  idp = await startMockIdp({ redirectUris: [REDIRECT] });
  java = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      javaCalls.push({
        method: req.method!,
        url: req.url!,
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  await new Promise<void>((r) => java.listen(0, r));
  javaUrl = `http://localhost:${(java.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await idp.close();
  await new Promise((r) => java.close(r));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("APP_BASE_URL", APP);
  vi.stubEnv("OIDC_ISSUER", idp.issuer);
  vi.stubEnv("OIDC_CLIENT_ID", "ibe-web");
  vi.stubEnv("OIDC_CLIENT_SECRET", "dev-secret");
  vi.stubEnv("OIDC_REDIRECT_URI", REDIRECT);
  vi.stubEnv("JAVA_API_BASE_URL", javaUrl);
  vi.stubEnv("SESSION_TTL_SECONDS", "3600");
  vi.stubEnv("SESSION_MAX_AGE_SECONDS", "28800");
  store = new MemorySessionStore();
  setSessionStoreForTests(store);
  resetOidcCaches();
  jar.cookies = {};
  javaCalls.length = 0;
  idp.state.log.length = 0;
  idp.state.sessions.clear();
});

// -------------------------------------------------------------------- tests
describe("login redirect", () => {
  it("sends the browser to the IdP with PKCE, state and nonce, and sets the temporary cookie", async () => {
    const b = new Browser();
    const res = await loginGET(b.req(`${APP}/auth/login?returnTo=/booking`));
    expect(res.status).toBe(302);

    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe(`${idp.issuer}/authorize`);
    expect(to.searchParams.get("response_type")).toBe("code");
    expect(to.searchParams.get("client_id")).toBe("ibe-web");
    expect(to.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(to.searchParams.get("scope")).toBe("openid profile email");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(to.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(to.searchParams.get("nonce")).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const tmp = res.cookies.get("auth_tmp")!;
    expect(tmp.httpOnly).toBe(true);
    expect(tmp.sameSite).toBe("lax");
    expect(tmp.path).toBe("/auth");
    expect(tmp.maxAge).toBe(600);
    // The verifier lives only in the cookie, never in the URL.
    expect(tmp.value).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // payload.signature
    const inCookie = readLoginState(tmp.value)!;
    expect(inCookie.state).toBe(to.searchParams.get("state"));
    expect(to.toString()).not.toContain(inCookie.verifier);
  });

  it("answers 503 when the OIDC settings are missing", async () => {
    vi.stubEnv("OIDC_CLIENT_SECRET", "");
    const res = await loginGET(new Browser().req(`${APP}/auth/login`));
    expect(res.status).toBe(503);
    expect((await res.json()).missing).toContain("OIDC_CLIENT_SECRET");
  });

  it("redirects to the error page when the IdP is unreachable", async () => {
    vi.stubEnv("OIDC_ISSUER", "http://localhost:1"); // nothing listens there
    const res = await loginGET(new Browser().req(`${APP}/auth/login`));
    expect(res.headers.get("location")).toBe(`${APP}/login-error?reason=idp_unreachable`);
  });
});

describe("happy path", () => {
  it("logs in, lands on returnTo, sets only the session cookie and clears the temporary one", async () => {
    const b = new Browser();
    const { callbackRes } = await login(b, "/booking");

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get("location")).toBe(`${APP}/booking`);

    const session = callbackRes.cookies.get("ibe_session")!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("lax");
    expect(session.path).toBe("/");
    expect(session.maxAge).toBe(3600);
    expect(session.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect("domain" in session ? session.domain : undefined).toBeUndefined(); // host-only
    expect(b.cookies.has("auth_tmp")).toBe(false); // single use

    // The cookie value is only an id: the tokens are in the store, not in the cookie.
    const stored = await store.get(session.value);
    expect(stored?.sub).toBe("user-123");
    expect(stored?.email).toBe("test.user@example.com");
    expect(stored?.accessToken.split(".")).toHaveLength(3);
    expect(stored?.refreshToken).toBeTruthy();
    expect(session.value).not.toContain(stored!.accessToken);

    expect((await currentSession())?.s.name).toBe("Test User");
  });

  it("issues a new session id at every login", async () => {
    const first = new Browser();
    const second = new Browser();
    await login(first);
    await login(second);
    expect(sessionIdOf(first)).not.toBe(sessionIdOf(second));
  });

  it("falls back to / for an unsafe returnTo", async () => {
    const b = new Browser();
    const { callbackRes } = await login(b, "//evil.com");
    expect(callbackRes.headers.get("location")).toBe(`${APP}/`);
  });
});

describe("callback checks", () => {
  it("rejects a tampered state", async () => {
    const b = new Browser();
    const loginRes = await loginGET(b.req(`${APP}/auth/login`));
    b.absorb(loginRes);
    const idpRes = await fetch(loginRes.headers.get("location")!, { redirect: "manual" });
    const cb = new URL(idpRes.headers.get("location")!);
    cb.searchParams.set("state", "tampered");
    const res = await callbackGET(b.req(cb.toString()));
    expect(res.headers.get("location")).toBe(`${APP}/login-error?reason=state_mismatch`);
    expect(res.cookies.get("ibe_session")).toBeUndefined();
  });

  it("rejects a callback with no temporary cookie", async () => {
    const b = new Browser();
    const res = await callbackGET(b.req(`${REDIRECT}?code=x&state=y`));
    expect(res.headers.get("location")).toBe(
      `${APP}/login-error?reason=missing_login_state`,
    );
  });

  it("rejects replaying the same callback URL (the code is single use)", async () => {
    const b = new Browser();
    const { callbackUrl } = await login(b);
    // Even if the old temporary cookie were still around, the code is spent.
    const loginRes = await loginGET(b.req(`${APP}/auth/login`));
    b.absorb(loginRes);
    const replay = new URL(callbackUrl);
    const fresh = readLoginState(loginRes.cookies.get("auth_tmp")!.value)!;
    replay.searchParams.set("state", fresh.state);
    const res = await callbackGET(b.req(replay.toString()));
    expect(res.headers.get("location")).toBe(
      `${APP}/login-error?reason=token_exchange_failed`,
    );
  });

  // The temporary cookie is signed, so a cookie someone else wrote is not trusted.
  describe("the temporary login cookie", () => {
    /** Starts a login and returns what the IdP would send back, plus the real cookie. */
    async function startLogin(b: Browser) {
      const loginRes = await loginGET(b.req(`${APP}/auth/login?returnTo=/booking`));
      b.absorb(loginRes);
      const idpRes = await fetch(loginRes.headers.get("location")!, {
        redirect: "manual",
      });
      return {
        callbackUrl: idpRes.headers.get("location")!,
        cookie: loginRes.cookies.get("auth_tmp")!.value,
      };
    }
    const callbackWith = (callbackUrl: string, cookie: string) =>
      callbackGET(
        new NextRequest(callbackUrl, { headers: { cookie: `auth_tmp=${cookie}` } }),
      );
    const reasonOf = (res: Response) =>
      new URL(res.headers.get("location")!).searchParams.get("reason");

    it("rejects an unsigned (forged) cookie even when its contents are consistent", async () => {
      const b = new Browser();
      const { callbackUrl, cookie } = await startLogin(b);
      const real = readLoginState(cookie)!;
      const forged = Buffer.from(JSON.stringify(real)).toString("base64url"); // right data, no signature
      expect(reasonOf(await callbackWith(callbackUrl, forged))).toBe("bad_login_state");
    });

    it("rejects a cookie that was edited after it was signed", async () => {
      const b = new Browser();
      const { callbackUrl, cookie } = await startLogin(b);
      const [payload, mac] = cookie.split(".");
      const edited = { ...readLoginState(cookie)!, returnTo: "//evil.com" };
      const tampered = `${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${mac}`;
      expect(payload).not.toBe(tampered.split(".")[0]);
      expect(reasonOf(await callbackWith(callbackUrl, tampered))).toBe("bad_login_state");
    });

    it("rejects a cookie signed with a different secret", async () => {
      const b = new Browser();
      const { callbackUrl, cookie } = await startLogin(b);
      const real = readLoginState(cookie)!;
      vi.stubEnv("OIDC_CLIENT_SECRET", "someone-elses-secret");
      const foreign = signLoginState(real);
      vi.stubEnv("OIDC_CLIENT_SECRET", "dev-secret");
      expect(reasonOf(await callbackWith(callbackUrl, foreign))).toBe("bad_login_state");
    });

    it("never redirects off-site, even for a validly signed cookie with a bad returnTo", async () => {
      const b = new Browser();
      const { callbackUrl, cookie } = await startLogin(b);
      const risky = signLoginState({
        ...readLoginState(cookie)!,
        returnTo: "//evil.com",
      });
      const res = await callbackWith(callbackUrl, risky);
      expect(res.headers.get("location")).toBe(`${APP}/`); // re-checked in the callback
      expect(res.cookies.get("ibe_session")).toBeDefined(); // the login itself still succeeded
    });
  });

  it("passes an IdP error such as access_denied to the error page", async () => {
    const b = new Browser();
    const loginRes = await loginGET(b.req(`${APP}/auth/login`));
    b.absorb(loginRes);
    const state = new URL(loginRes.headers.get("location")!).searchParams.get("state")!;
    const res = await callbackGET(
      b.req(`${REDIRECT}?error=access_denied&state=${state}`),
    );
    expect(res.headers.get("location")).toBe(`${APP}/login-error?reason=access_denied`);
  });
});

describe("sessions", () => {
  it("treats a forged session cookie as logged out", async () => {
    jar.cookies = { ibe_session: "abc" };
    expect(await currentSession()).toBeNull();
  });

  it("ends a session after the absolute lifetime", async () => {
    const b = new Browser();
    await login(b);
    const id = sessionIdOf(b)!;
    const s = (await store.get(id))!;
    await store.save(id, { ...s, createdAt: Math.floor(Date.now() / 1000) - 28801 });
    expect(await currentSession()).toBeNull();
    expect(await store.get(id)).toBeNull();
  });
});

describe("proxy to the Java API", () => {
  const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

  it("answers 401 without a session and never calls Java", async () => {
    const res = await proxyGET(
      new Browser().req(`${APP}/api/ibe/bookings/me`),
      ctx("bookings", "me"),
    );
    expect(res.status).toBe(401);
    expect(javaCalls).toHaveLength(0);
  });

  it("adds the bearer token server side and returns Java's answer", async () => {
    const b = new Browser();
    await login(b);
    const res = await proxyGET(
      b.req(`${APP}/api/ibe/bookings/me?x=1`),
      ctx("bookings", "me"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, path: "/api/bookings/me?x=1" });

    const stored = (await store.get(sessionIdOf(b)!))!;
    expect(javaCalls).toHaveLength(1);
    expect(javaCalls[0].authorization).toBe(`Bearer ${stored.accessToken}`);
  });

  it("rejects a write without a same-origin Origin header (403)", async () => {
    const b = new Browser();
    await login(b);
    const evil = await proxyPOST(
      b.req(`${APP}/api/ibe/bookings`, {
        method: "POST",
        body: "{}",
        headers: { origin: "https://evil.com" },
      }),
      ctx("bookings"),
    );
    const none = await proxyPOST(
      b.req(`${APP}/api/ibe/bookings`, { method: "POST", body: "{}" }),
      ctx("bookings"),
    );
    expect([evil.status, none.status]).toEqual([403, 403]);
    expect(javaCalls).toHaveLength(0);
  });

  it("forwards a write with a same-origin Origin header", async () => {
    const b = new Browser();
    await login(b);
    const res = await proxyPOST(
      b.req(`${APP}/api/ibe/bookings`, {
        method: "POST",
        body: '{"a":1}',
        headers: { origin: APP, "content-type": "application/json" },
      }),
      ctx("bookings"),
    );
    expect(res.status).toBe(200);
    expect(javaCalls[0]).toMatchObject({
      method: "POST",
      url: "/api/bookings",
      body: '{"a":1}',
    });
  });

  it("answers 502 when Java is unreachable", async () => {
    const b = new Browser();
    await login(b);
    vi.stubEnv("JAVA_API_BASE_URL", "http://localhost:1");
    const res = await proxyGET(
      b.req(`${APP}/api/ibe/bookings/me`),
      ctx("bookings", "me"),
    );
    expect(res.status).toBe(502);
  });

  it("refreshes an expired access token transparently and rotates the refresh token", async () => {
    const b = new Browser();
    await login(b);
    const id = sessionIdOf(b)!;
    const before = (await store.get(id))!;
    await store.save(id, { ...before, accessExp: Math.floor(Date.now() / 1000) - 5 });

    const res = await proxyGET(
      b.req(`${APP}/api/ibe/bookings/me`),
      ctx("bookings", "me"),
    );
    expect(res.status).toBe(200);

    const after = (await store.get(id))!;
    expect(after.accessToken).not.toBe(before.accessToken);
    expect(after.refreshToken).not.toBe(before.refreshToken); // rotated
    expect(javaCalls[0].authorization).toBe(`Bearer ${after.accessToken}`);
    expect(idp.state.log.filter((e) => e.type === "token_refresh")).toHaveLength(1);
  });

  it("refreshes only once when several requests arrive at the same time", async () => {
    const b = new Browser();
    await login(b);
    const id = sessionIdOf(b)!;
    const s = (await store.get(id))!;
    await store.save(id, { ...s, accessExp: Math.floor(Date.now() / 1000) - 5 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        proxyGET(b.req(`${APP}/api/ibe/bookings/me`), ctx("bookings", "me")),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(idp.state.log.filter((e) => e.type === "token_refresh")).toHaveLength(1);
  });

  it("ends the session and answers 401 when the refresh token is rejected", async () => {
    const b = new Browser();
    await login(b);
    const id = sessionIdOf(b)!;
    const s = (await store.get(id))!;
    await store.save(id, { ...s, accessExp: Math.floor(Date.now() / 1000) - 5 });
    idp.state.sessions.clear(); // the vendor session is gone

    const res = await proxyGET(
      b.req(`${APP}/api/ibe/bookings/me`),
      ctx("bookings", "me"),
    );
    expect(res.status).toBe(401);
    expect(await store.get(id)).toBeNull();
    expect(javaCalls).toHaveLength(0);
  });
});

describe("/auth/session (what the header asks)", () => {
  it("says enabled with no user when nobody is logged in", async () => {
    const res = await sessionGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ enabled: true, user: null });
  });

  it("returns only display data for a logged-in user, never a token or the session id", async () => {
    const b = new Browser();
    await login(b);
    const stored = (await store.get(sessionIdOf(b)!))!;

    const res = await sessionGET();
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      enabled: true,
      user: { name: "Test User", email: "test.user@example.com" },
    });
    for (const secret of [
      stored.accessToken,
      stored.idToken,
      stored.refreshToken!,
      sessionIdOf(b)!,
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("treats a forged cookie as logged out", async () => {
    jar.cookies = { ibe_session: "forged" };
    expect(await (await sessionGET()).json()).toEqual({ enabled: true, user: null });
  });

  it("says disabled when the OIDC settings are missing, so the header falls back to the old sign-in", async () => {
    vi.stubEnv("OIDC_CLIENT_SECRET", "");
    expect(await (await sessionGET()).json()).toEqual({ enabled: false, user: null });
  });

  it("answers 503 (still signed-out) when the session store is unavailable", async () => {
    setSessionStoreForTests({
      ...store,
      get: async () => {
        throw new Error("redis down");
      },
    } as unknown as MemorySessionStore);
    jar.cookies = { ibe_session: "anything" };
    const res = await sessionGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ enabled: true, user: null });
  });
});

describe("logout", () => {
  it("deletes the session record, clears the cookie and ends the vendor session", async () => {
    const b = new Browser();
    await login(b);
    const id = sessionIdOf(b)!;
    const idToken = (await store.get(id))!.idToken;

    const res = await logoutPOST();
    b.absorb(res);
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe(`${idp.issuer}/logout`);
    expect(to.searchParams.get("id_token_hint")).toBe(idToken);
    expect(to.searchParams.get("post_logout_redirect_uri")).toBe(`${APP}/`);

    expect(await store.get(id)).toBeNull(); // the record is gone, not just the cookie
    expect(b.cookies.has("ibe_session")).toBe(false);

    // Following the redirect ends the session at the IdP and comes back to the app.
    const idpRes = await fetch(to, { redirect: "manual" });
    expect(idpRes.headers.get("location")).toBe(`${APP}/`);
    expect(idp.state.log.some((e) => e.type === "logout")).toBe(true);
  });

  it("without a session just goes home", async () => {
    const res = await logoutPOST();
    expect(res.headers.get("location")).toBe(`${APP}/`);
  });
});

describe("back-channel logout", () => {
  const post = (b: Browser, token: string | undefined) =>
    backchannelPOST(
      new NextRequest(`${APP}/auth/backchannel-logout`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(token ? { logout_token: token } : {}),
      }),
    );

  const mint = async (body: object) =>
    (
      (await (
        await fetch(`${idp.issuer}/dev/logout-token`, {
          method: "POST",
          body: JSON.stringify(body),
        })
      ).json()) as {
        logout_token: string;
      }
    ).logout_token;

  it("deletes the sessions of the vendor session id", async () => {
    const a = new Browser();
    const other = new Browser();
    await login(a);
    await login(other);
    const sidA = (await store.get(sessionIdOf(a)!))!.sid!;

    const res = await post(a, await mint({ sid: sidA }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await store.get(sessionIdOf(a)!)).toBeNull();
    expect(await store.get(sessionIdOf(other)!)).not.toBeNull(); // another login is untouched
  });

  it("rejects missing, malformed, or nonce-carrying logout tokens", async () => {
    const b = new Browser();
    await login(b);
    expect((await post(b, undefined)).status).toBe(400);
    expect((await post(b, "not.a.jwt")).status).toBe(400);
    expect((await post(b, await mint({ sid: "x", nonce: "n" }))).status).toBe(400);
    expect(await store.get(sessionIdOf(b)!)).not.toBeNull();
  });

  it("rejects a token that is an access token, not a logout token", async () => {
    const b = new Browser();
    await login(b);
    const at = (
      (await (
        await fetch(`${idp.issuer}/dev/mint`, { method: "POST", body: "{}" })
      ).json()) as { access_token: string }
    ).access_token;
    expect((await post(b, at)).status).toBe(400);
  });
});
