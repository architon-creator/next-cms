// Config for the OIDC (BFF) login. Read from the environment on every call
// instead of once at import, so a build never needs the values and tests can
// change them. Secrets (OIDC_CLIENT_SECRET) must come from the environment /
// a secrets manager, never from git.

export const SESSION_COOKIE_NAME = "ibe_session";
export const TMP_COOKIE_NAME = "auth_tmp";

const REQUIRED = [
  "APP_BASE_URL",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_REDIRECT_URI",
] as const;

/** Names of required settings that are missing (empty means: fully configured). */
export function missingOidcEnv(): string[] {
  return REQUIRED.filter((name) => !process.env[name]);
}

const trimSlash = (v: string) => v.replace(/\/+$/, "");

export function oidcConfig() {
  const e = process.env;
  return {
    // Always build redirect URLs from this, never from req.url: behind the
    // load balancer req.url can show the internal host.
    appBaseUrl: trimSlash(e.APP_BASE_URL ?? ""),
    issuer: trimSlash(e.OIDC_ISSUER ?? ""),
    clientId: e.OIDC_CLIENT_ID ?? "",
    clientSecret: e.OIDC_CLIENT_SECRET ?? "",
    // Key for signing the temporary login cookie. Defaults to the client secret
    // (already a server-only secret); set AUTH_COOKIE_SECRET to use a separate one.
    authCookieSecret: e.AUTH_COOKIE_SECRET || e.OIDC_CLIENT_SECRET || "",
    redirectUri: e.OIDC_REDIRECT_URI ?? "",
    scope: e.OIDC_SCOPE ?? "openid profile email",
    // Pin the ID token signing algorithm to what the vendor uses.
    idTokenAlg: e.OIDC_ID_TOKEN_ALG ?? "RS256",
    sessionTtl: Number(e.SESSION_TTL_SECONDS ?? 3600),
    // Absolute session limit, however often it is refreshed (default 8h).
    sessionMaxAge: Number(e.SESSION_MAX_AGE_SECONDS ?? 28800),
    javaBase: trimSlash(e.JAVA_API_BASE_URL ?? "http://localhost:4001"),
    // Secure cookies need HTTPS. Chrome allows them on localhost, Safari does not.
    cookieSecure: e.NODE_ENV === "production",
    // Short timeout for calls to the vendor (discovery, token, JWKS).
    httpTimeoutMs: Number(e.OIDC_HTTP_TIMEOUT_MS ?? 5000),
  };
}

export type OidcConfig = ReturnType<typeof oidcConfig>;
