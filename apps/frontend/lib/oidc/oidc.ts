import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { oidcConfig } from "./config";

export type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
};

export type TokenResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
};

export const b64url = (b: Buffer) => b.toString("base64url");
/** 32 random bytes from the OS RNG, base64url. Used for state, nonce, verifier, session ids. */
export const rand = () => b64url(randomBytes(32));
/** PKCE S256 code challenge for a verifier (RFC 7636). */
export const challengeOf = (verifier: string) =>
  b64url(createHash("sha256").update(verifier).digest());

// Cached per issuer so tests (and a vendor migration) can use several.
const discoveryCache = new Map<string, { value: Discovery; at: number }>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function resetOidcCaches() {
  discoveryCache.clear();
  jwksCache.clear();
}

export async function discovery(): Promise<Discovery> {
  const cfg = oidcConfig();
  const hit = discoveryCache.get(cfg.issuer);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;

  const res = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
    cache: "no-store",
    signal: AbortSignal.timeout(cfg.httpTimeoutMs),
  });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const value = (await res.json()) as Discovery;
  // OIDC Discovery: the issuer in the metadata must equal the one we asked.
  if (value.issuer.replace(/\/+$/, "") !== cfg.issuer) {
    throw new Error("OIDC discovery issuer mismatch");
  }
  discoveryCache.set(cfg.issuer, { value, at: Date.now() });
  jwksCache.delete(cfg.issuer); // rebuild the key set from the fresh jwks_uri
  return value;
}

async function jwksFor(d: Discovery) {
  const cfg = oidcConfig();
  let set = jwksCache.get(cfg.issuer);
  if (!set) {
    set = createRemoteJWKSet(new URL(d.jwks_uri), { timeoutDuration: cfg.httpTimeoutMs });
    jwksCache.set(cfg.issuer, set);
  }
  return set;
}

/** Token endpoint call with client_secret_basic. Switch to client_secret_post if the vendor requires it. */
export async function tokenRequest(
  params: Record<string, string>,
): Promise<TokenResponse> {
  const cfg = oidcConfig();
  const d = await discovery();
  const basic = Buffer.from(
    `${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`,
  ).toString("base64");

  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(params),
    cache: "no-store",
    signal: AbortSignal.timeout(cfg.httpTimeoutMs),
  });
  if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
  return (await res.json()) as TokenResponse;
}

/** Verifies signature, iss, aud (= our client id), exp, and the nonce. */
export async function verifyIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<JWTPayload> {
  const cfg = oidcConfig();
  const d = await discovery();
  const { payload } = await jwtVerify(idToken, await jwksFor(d), {
    issuer: d.issuer,
    audience: cfg.clientId,
    algorithms: [cfg.idTokenAlg],
  });
  if (payload.nonce !== expectedNonce) throw new Error("nonce mismatch");
  return payload;
}

const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";

/** Verifies an OIDC back-channel logout token and returns its sid / sub. */
export async function verifyLogoutToken(
  logoutToken: string,
): Promise<{ sid?: string; sub?: string }> {
  const cfg = oidcConfig();
  const d = await discovery();
  const { payload } = await jwtVerify(logoutToken, await jwksFor(d), {
    issuer: d.issuer,
    audience: cfg.clientId,
    algorithms: [cfg.idTokenAlg],
  });
  const events = payload.events as Record<string, unknown> | undefined;
  if (!events || !(BACKCHANNEL_EVENT in events)) throw new Error("not a logout token");
  if ("nonce" in payload) throw new Error("logout token must not have a nonce");
  const sid = typeof payload.sid === "string" ? payload.sid : undefined;
  const sub = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!sid && !sub) throw new Error("logout token has neither sid nor sub");
  return { sid, sub };
}

/** What the temporary login cookie carries. `iat` is added when it is signed. */
export type LoginState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  iat: number; // epoch seconds
};

/** A login must be finished within this long (also the cookie's Max-Age). */
export const LOGIN_STATE_TTL_SECONDS = 600;

const tmpMac = (payload: string) =>
  createHmac("sha256", `auth_tmp|${oidcConfig().authCookieSecret}`)
    .update(payload)
    .digest("base64url");

/**
 * Value of the temporary login cookie: the state as base64url JSON plus an HMAC
 * of it. Without the signature, anyone able to write cookies for the site (a
 * sibling subdomain, a network attacker on plain HTTP) could forge it.
 */
export function signLoginState(data: Omit<LoginState, "iat">): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ ...data, iat })).toString("base64url");
  return `${payload}.${tmpMac(payload)}`;
}

/**
 * The state inside a cookie made by signLoginState(), or null if it is forged,
 * edited, malformed or too old. The age is checked here, from the signed
 * timestamp, because the browser's Max-Age is not something the server can trust:
 * a copy of the value would otherwise verify for ever.
 */
export function readLoginState(value: string): LoginState | null {
  const [payload, mac, extra] = value.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = Buffer.from(tmpMac(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as LoginState;
    if (
      typeof data.state !== "string" ||
      typeof data.nonce !== "string" ||
      typeof data.verifier !== "string" ||
      typeof data.returnTo !== "string" ||
      typeof data.iat !== "number"
    ) {
      return null;
    }
    const age = Math.floor(Date.now() / 1000) - data.iat;
    // Too old, or from the future (beyond a little clock skew).
    return age > LOGIN_STATE_TTL_SECONDS || age < -60 ? null : data;
  } catch {
    return null;
  }
}

/** Only allow same-site relative paths, to prevent open redirects. */
export function safeReturnTo(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  return v;
}
