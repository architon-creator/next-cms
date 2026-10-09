# IBE login: Next.js + Java + external IdP (OIDC)

> New to this? Read [ibe-login-explained.md](ibe-login-explained.md) first: the same flow explained step by step, with the security reasons in plain words.

Implementation of the "IBE Login Integration" guide: the **Next.js server** runs the
OIDC Authorization Code + PKCE flow against the identity provider (IdP), keeps the tokens
in a session store, and gives the browser only an `HttpOnly` session cookie. The **Java API**
is a stateless OAuth2 resource server that validates the access token on every call. The
browser never calls Java directly.

This login is **added beside** the existing login (`/login`, `/api/auth/*`, Express API).
Nothing existing was changed or removed.

## What was built

| Area            | Files                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config, helpers | `apps/frontend/lib/oidc/config.ts`, `oidc.ts` (PKCE, discovery, token calls, ID/logout token checks, `safeReturnTo`)                                              |
| Sessions        | `lib/oidc/session-store.ts` (Redis, plus an in-memory fallback for development), `lib/oidc/auth.ts` (`currentSession`, `validAccessToken` with refresh)           |
| Routes          | `app/auth/login`, `app/auth/callback`, `app/auth/logout` (POST), `app/auth/backchannel-logout` (POST)                                                             |
| Proxy to Java   | `app/api/ibe/[...path]/route.ts` (`/api/ibe/x` becomes Java `/api/x` with `Authorization: Bearer <token>`)                                                        |
| Pages           | `app/[locale]/account` (example protected page), `app/[locale]/login-error`                                                                                       |
| Gate            | `apps/frontend/proxy.ts`: `/account` needs the session cookie; `/auth/*` is excluded from locale rewriting                                                        |
| Java            | `apps/java-api/.../security/SecurityConfig.java`, `.../booking/BookingController.java` (`GET /api/bookings/me`, `GET /api/bookings` needing scope `booking.read`) |
| Dev IdP         | `apps/frontend/scripts/mock-idp.mjs` (`pnpm idp:mock`), a mock OpenID provider for development and tests only                                                     |
| Infra           | `docker-compose.yml` (`redis`, `keycloak`), `docker/keycloak/ibe-realm.json`, `apps/frontend/.env.example`                                                        |

Deliberate differences from the guide, because of this repo:

- Files are under `lib/oidc/` (the guide's `lib/session.ts` already exists here for the other login).
- `proxy.ts`, not `middleware.ts`: this Next.js version (16) renamed it. Its matcher now also skips `auth/`, otherwise `/auth/login` would be rewritten to `/en/auth/login` and 404.
- The Java API keeps `/demo/**`, `/uploads/**` and the H2 console **open** (the product form needs no login). Only `/api/**` requires a token. Tighten this when those need auth.
- Back-channel logout is implemented (the guide left it optional), and the session store also indexes sessions by `sub`.

## Run it locally (no vendor needed)

1. **Mock IdP** (terminal 1): `pnpm idp:mock` listens on `http://localhost:9000` and shows a "Log in" button (`AUTO_APPROVE=1` skips it). Client `ibe-web`, secret `dev-secret`, audience `ibe-api`.
2. **Java** (terminal 2): `pnpm java:dev`. Its default issuer is `http://localhost:9000`; set `OIDC_ISSUER` / `API_AUDIENCE` for anything else. It starts even if the IdP is down.
3. **Frontend**: add to `apps/frontend/.env.local`, then restart `pnpm dev`:

```env
APP_BASE_URL=http://localhost:3000
OIDC_ISSUER=http://localhost:9000
OIDC_CLIENT_ID=ibe-web
OIDC_CLIENT_SECRET=dev-secret
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
OIDC_SCOPE=openid profile email booking.read
JAVA_API_BASE_URL=http://localhost:4001
```

4. Open `http://localhost:3000/account`. With no session you are sent to log in, come back, and the page shows who you are and a button that calls the secured Java endpoint.

Without `REDIS_URL`, sessions are kept in memory (development only). In production the app refuses to start without it.

**Keycloak instead of the mock** (needs Docker): `docker compose up -d keycloak redis`, then `OIDC_ISSUER=http://localhost:8081/realms/ibe` (user `test.user` / `test`, client secret `dev-secret`). This setup is **untested**: Docker was not running when it was written, so the realm file may need adjustments.

## Scopes

The Java list endpoint needs `SCOPE_booking.read`. The access token only has the scopes the app **requested**, so `OIDC_SCOPE` must include `booking.read` (ask the vendor which scope or claim carries it).

## How a request is checked

- **Browser to Next:** the `ibe_session` cookie holds only a random id. The real check is the session-store lookup, so a forged or revoked cookie is just "logged out". The session cookie lasts `SESSION_TTL_SECONDS` (1 hour) from login and is not extended by activity; `SESSION_MAX_AGE_SECONDS` (8 hours) is a hard cap that matters if the TTL is set longer.
- **Next to Java:** the proxy adds the access token (refreshing it when it is about to expire; one request refreshes, parallel ones wait). Writes also need a same-origin `Origin` header.
- **Java:** validates signature (keys from the issuer's JWKS), `iss`, `exp`, `nbf` and `aud`, and uses `sub` as the identity.

## Tests

- **Frontend:** `pnpm --filter frontend test` runs 72 tests under `lib/oidc/`. The integration test calls the real route handlers against the mock IdP (a real HTTP server) and a fake Java: login, the guide's whole test plan (tampered or missing state, replayed code, forged session cookie, forged or edited login cookie, open redirect, origin check, refresh with rotation, concurrent refresh, rejected refresh, logout, back-channel logout) and the session stores (memory and Redis through `ioredis-mock`). I confirmed the tests can fail by breaking the state and origin checks on purpose.
- **Java:** `mvn -s apps/java-api/settings-central.xml -f apps/java-api test` (8 tests): 401 without a token, scope check, demo endpoints stay open, audience/issuer/expiry validators, and a clean 503 when the IdP is down.
- **End to end:** I also ran a real `next dev` server, the mock IdP and the Java jar together and drove the whole login with a cookie-keeping client (27 checks: gate, redirects, cookies, `/account`, the secured Java call with a real JWT, the 403/401 cases, logout, and that the existing pages still return 200). Real Java also rejected wrong-audience, expired, wrong-key, wrong-issuer and garbage tokens.

## Things found while testing (worth knowing for the vendor)

1. **`typ: at+jwt`.** Some IdPs (Auth0, Duende, anything following RFC 9068) sign access tokens with that JOSE header. Spring's default decoder only accepts `JWT` and rejects them with "type not allowed". The decoder now accepts both.
2. **IdP down.** A token could not be checked, which first surfaced as an unhandled exception (500). Java now answers `503 identity_provider_unavailable` (not 401, so the proxy does not make the user log in again).
3. **Scopes** (see above): a missing `booking.read` is a `403`, not an error in the flow.

## Security checklist status

Done in code: the temporary `auth_tmp` login cookie is **signed** (HMAC, key from `AUTH_COOKIE_SECRET` or the client secret), so a cookie written by someone else (a sibling subdomain, a network attacker on plain HTTP) is rejected, and `returnTo` is re-checked in the callback so the redirect can never leave the site; crypto-random `state`, `nonce`, verifier and session ids; `state` checked first; ID token checked for signature, `iss`, `aud`, `exp`, `nonce`; identical `redirect_uri` in both requests; `returnTo` limited to same-site paths; a new session id at every login; host-only cookies (no `Domain`); tokens never in cookies, URLs or logs; logout is a `POST` that deletes the session record; login links are plain anchors, not `<Link>`; error pages show only known reason codes.

Left for deployment: keep `OIDC_CLIENT_SECRET` in a secrets manager, use `rediss://` for Redis, restrict network access to Java to the Next.js service, make the load balancer forward `X-Forwarded-*` (not needed here: redirects use `APP_BASE_URL`), and set the vendor's real redirect URIs per environment.

## Still to agree with the vendor

The questions in section 12 of the guide still apply: OIDC or SAML, JWT or opaque access tokens (opaque needs introspection instead of the JWT config), `aud` and token lifetimes, refresh-token rotation, end-session and back-channel logout support, which claims carry name, email and loyalty id, token-endpoint auth method (`client_secret_basic` is used; `client_secret_post` is a one-line change in `tokenRequest`), `localhost` and staging redirect URIs, and MFA.
