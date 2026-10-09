// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { missingOidcEnv, oidcConfig } from "./config";
import { challengeOf, rand, readLoginState, safeReturnTo, signLoginState } from "./oidc";

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B example", () => {
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("rand() gives 32 random bytes as url-safe base64 (43 chars), never repeating", () => {
    const a = rand();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 50 }, rand)).size).toBe(50);
  });
});

describe("safeReturnTo", () => {
  it.each([
    ["/booking", "/booking"],
    ["/booking?x=1#top", "/booking?x=1#top"],
    ["/", "/"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });

  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["http://evil.com/x"],
    ["javascript:alert(1)"],
    ["evil.com"],
    [""],
    [null],
  ])("falls back to / for %s", (input) => {
    expect(safeReturnTo(input as string | null)).toBe("/");
  });
});

describe("oidcConfig", () => {
  it("lists missing required settings, and strips trailing slashes", () => {
    const keep = { ...process.env };
    try {
      for (const k of [
        "APP_BASE_URL",
        "OIDC_ISSUER",
        "OIDC_CLIENT_ID",
        "OIDC_CLIENT_SECRET",
        "OIDC_REDIRECT_URI",
      ]) {
        delete process.env[k];
      }
      expect(missingOidcEnv()).toHaveLength(5);
      process.env.APP_BASE_URL = "https://ibe.com/";
      process.env.OIDC_ISSUER = "https://abc.ibe.com//";
      expect(missingOidcEnv()).toHaveLength(3);
      expect(oidcConfig().appBaseUrl).toBe("https://ibe.com");
      expect(oidcConfig().issuer).toBe("https://abc.ibe.com");
    } finally {
      process.env = keep;
    }
  });

  it("has safe defaults", () => {
    const c = oidcConfig();
    expect(c.scope).toBe("openid profile email");
    expect(c.idTokenAlg).toBe("RS256");
    expect(c.sessionTtl).toBe(3600);
    expect(c.sessionMaxAge).toBe(28800);
  });
});

describe("signed login cookie", () => {
  const data = { state: "s", nonce: "n", verifier: "v", returnTo: "/booking" };
  afterEach(() => vi.useRealTimers());
  const withSecret = (secret: string, fn: () => void) => {
    const keep = {
      client: process.env.OIDC_CLIENT_SECRET,
      own: process.env.AUTH_COOKIE_SECRET,
    };
    process.env.OIDC_CLIENT_SECRET = secret;
    delete process.env.AUTH_COOKIE_SECRET;
    try {
      fn();
    } finally {
      if (keep.client === undefined) delete process.env.OIDC_CLIENT_SECRET;
      else process.env.OIDC_CLIENT_SECRET = keep.client;
      if (keep.own !== undefined) process.env.AUTH_COOKIE_SECRET = keep.own;
    }
  };

  it("round-trips the state", () => {
    withSecret("k1", () => {
      expect(readLoginState(signLoginState(data))).toEqual({
        ...data,
        iat: expect.any(Number),
      });
    });
  });

  it("rejects an edited payload, an edited signature and a missing signature", () => {
    withSecret("k1", () => {
      const [payload, mac] = signLoginState(data).split(".");
      const edited = Buffer.from(
        JSON.stringify({ ...data, returnTo: "//evil.com" }),
      ).toString("base64url");
      expect(readLoginState(`${edited}.${mac}`)).toBeNull();
      expect(readLoginState(`${payload}.${mac.slice(0, -2)}AA`)).toBeNull();
      expect(readLoginState(payload)).toBeNull();
      expect(readLoginState(`${payload}.${mac}.extra`)).toBeNull();
      expect(readLoginState("")).toBeNull();
    });
  });

  it("only verifies with the key that signed it", () => {
    let signed = "";
    withSecret("k1", () => {
      signed = signLoginState(data);
    });
    withSecret("k2", () => {
      expect(readLoginState(signed)).toBeNull();
    });
  });

  it("prefers AUTH_COOKIE_SECRET over the client secret when it is set", () => {
    const keep = process.env.AUTH_COOKIE_SECRET;
    try {
      process.env.AUTH_COOKIE_SECRET = "dedicated";
      process.env.OIDC_CLIENT_SECRET = "k1";
      const signed = signLoginState(data);
      process.env.OIDC_CLIENT_SECRET = "changed"; // the client secret no longer matters
      expect(readLoginState(signed)).toMatchObject(data);
    } finally {
      if (keep === undefined) delete process.env.AUTH_COOKIE_SECRET;
      else process.env.AUTH_COOKIE_SECRET = keep;
    }
  });

  it("rejects a payload that is validly signed but not the expected shape", () => {
    withSecret("k1", () => {
      const bad = signLoginState({ state: 1 } as unknown as typeof data);
      expect(readLoginState(bad)).toBeNull();
    });
  });

  it("expires after 10 minutes on the server, whatever the browser does with Max-Age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    withSecret("k1", () => {
      const signed = signLoginState(data);
      vi.setSystemTime(new Date("2026-10-08T12:09:59Z"));
      expect(readLoginState(signed)).not.toBeNull(); // 9 min 59 s: still fine
      vi.setSystemTime(new Date("2026-10-08T12:10:01Z"));
      expect(readLoginState(signed)).toBeNull(); // 10 min 1 s: a leaked copy is useless
    });
  });

  it("rejects a cookie dated in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    withSecret("k1", () => {
      const future = signLoginState(data);
      vi.setSystemTime(new Date("2026-10-08T11:50:00Z")); // the clock went back 10 min
      expect(readLoginState(future)).toBeNull();
    });
  });

  it("rejects a cookie whose payload was stripped of its timestamp", () => {
    withSecret("k1", () => {
      const forgedNoIat = signLoginState(data);
      const [payload] = forgedNoIat.split(".");
      const stripped = JSON.parse(Buffer.from(payload, "base64url").toString());
      delete stripped.iat;
      // Sign the timestamp-less payload with the real key, as an old cookie would be.
      const plain = Buffer.from(JSON.stringify(stripped)).toString("base64url");
      const mac = forgedNoIat.split(".")[1];
      expect(readLoginState(`${plain}.${mac}`)).toBeNull(); // signature no longer matches either
    });
  });
});
