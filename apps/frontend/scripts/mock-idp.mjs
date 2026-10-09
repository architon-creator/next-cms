// A small mock OpenID Connect provider for DEVELOPMENT AND TESTS ONLY. It speaks
// enough real OIDC for the IBE login flow: discovery, JWKS, the authorization
// endpoint (Authorization Code + PKCE), the token endpoint (authorization_code
// and refresh_token with rotation, client_secret_basic / _post), and an
// end-session endpoint. It also has /dev/* helpers to mint tokens with custom
// claims (wrong audience, expired, wrong key) for negative tests of the Java API.
//
// Run it:   pnpm idp:mock          (http://localhost:9000, auto-approves with a button)
// Env:      PORT, ISSUER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URIS (comma separated),
//           AUDIENCE, ACCESS_TTL (seconds), AUTO_APPROVE=1 (skip the login page)
//
// Never run this anywhere real: it has no authentication of its own.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const rand = () => b64url(randomBytes(24));
const sha256url = (s) => b64url(createHash("sha256").update(s).digest());

export async function startMockIdp(options = {}) {
  const o = {
    port: 0,
    clientId: "ibe-web",
    clientSecret: "dev-secret",
    redirectUris: ["http://localhost:3000/auth/callback"],
    audience: "ibe-api",
    accessTtl: 300,
    idTtl: 300,
    autoApprove: true,
    scope: "openid profile email booking.read",
    user: { sub: "user-123", email: "test.user@example.com", name: "Test User" },
    ...options,
  };

  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256"); // for "signed with the wrong key" tokens
  const kid = "mock-idp-key-1";
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };

  const state = {
    codes: new Map(), // code -> { redirectUri, challenge, nonce, scope, sid, exp, used }
    refresh: new Map(), // refresh token -> { sid, scope, used }
    sessions: new Set(), // active vendor session ids (sid)
    log: [], // for tests: { type, ... }
  };

  let issuer = o.issuer; // filled in after listen when the port is dynamic

  async function sign(claims, { key = privateKey, expiresIn = o.accessTtl, typ } = {}) {
    const now = Math.floor(Date.now() / 1000);
    let jwt = new SignJWT({ ...claims })
      .setProtectedHeader({ alg: "RS256", kid, ...(typ ? { typ } : {}) })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .setJti(randomUUID());
    if (claims.iss === undefined) jwt = jwt.setIssuer(issuer);
    return jwt.sign(key);
  }

  const accessTokenFor = (sid, scope, extra = {}) =>
    sign(
      { sub: o.user.sub, aud: o.audience, scope, client_id: o.clientId, sid, ...extra },
      { typ: "at+jwt" },
    );

  const idTokenFor = (sid, nonce) =>
    sign(
      {
        sub: o.user.sub,
        aud: o.clientId,
        nonce,
        sid,
        email: o.user.email,
        name: o.user.name,
        auth_time: Math.floor(Date.now() / 1000),
      },
      { expiresIn: o.idTtl },
    );

  function clientAuth(req, form) {
    const h = req.headers.authorization;
    if (h?.startsWith("Basic ")) {
      const [id, secret] = Buffer.from(h.slice(6), "base64")
        .toString()
        .split(":")
        .map(decodeURIComponent);
      return id === o.clientId && secret === o.clientSecret;
    }
    return (
      form.get("client_id") === o.clientId && form.get("client_secret") === o.clientSecret
    );
  }

  const send = (res, status, body, headers = {}) => {
    const isJson = typeof body === "object" && body !== null;
    res.writeHead(status, {
      "Content-Type": isJson ? "application/json" : "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(isJson ? JSON.stringify(body) : body);
  };
  const redirect = (res, url) => {
    res.writeHead(302, { Location: url, "Cache-Control": "no-store" });
    res.end();
  };
  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    });

  function approve(res, p) {
    const sid = randomUUID();
    state.sessions.add(sid);
    const code = rand();
    state.codes.set(code, {
      redirectUri: p.get("redirect_uri"),
      challenge: p.get("code_challenge"),
      nonce: p.get("nonce"),
      scope: p.get("scope") || o.scope,
      sid,
      exp: Date.now() + 60_000,
      used: false,
    });
    state.log.push({ type: "code_issued", sid });
    const to = new URL(p.get("redirect_uri"));
    to.searchParams.set("code", code);
    if (p.get("state")) to.searchParams.set("state", p.get("state"));
    redirect(res, to.toString());
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, issuer || "http://localhost");
    const path = url.pathname;
    try {
      // ---- discovery + keys
      if (path === "/.well-known/openid-configuration") {
        return send(res, 200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          end_session_endpoint: `${issuer}/logout`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
          ],
          scopes_supported: ["openid", "profile", "email", "booking.read"],
          claims_supported: ["sub", "email", "name", "sid"],
        });
      }
      if (path === "/jwks") return send(res, 200, { keys: [jwk] });

      // ---- authorization endpoint
      if (path === "/authorize" && req.method === "GET") {
        const p = url.searchParams;
        if (p.get("client_id") !== o.clientId)
          return send(res, 400, { error: "unauthorized_client" });
        if (!o.redirectUris.includes(p.get("redirect_uri")))
          return send(res, 400, { error: "invalid_redirect_uri" });
        if (p.get("response_type") !== "code")
          return send(res, 400, { error: "unsupported_response_type" });
        if (!p.get("code_challenge") || p.get("code_challenge_method") !== "S256") {
          return send(res, 400, {
            error: "invalid_request",
            error_description: "PKCE (S256) is required",
          });
        }
        if (o.autoApprove) return approve(res, p);
        const hidden = [...p.entries()]
          .map(
            ([k, v]) =>
              `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`,
          )
          .join("");
        return send(
          res,
          200,
          `<!doctype html><meta charset="utf-8"><title>Mock IdP</title>
<body style="font-family:sans-serif;max-width:28rem;margin:4rem auto">
<h1>Mock identity provider</h1><p>Development only. Log in as <b>${o.user.name}</b> (${o.user.email}).</p>
<form method="post" action="/authorize">${hidden}
<button name="decision" value="allow" style="padding:.5rem 1rem">Log in</button>
<button name="decision" value="deny" style="padding:.5rem 1rem">Deny</button></form></body>`,
        );
      }
      if (path === "/authorize" && req.method === "POST") {
        const p = new URLSearchParams(await readBody(req));
        if (!o.redirectUris.includes(p.get("redirect_uri")))
          return send(res, 400, { error: "invalid_redirect_uri" });
        if (p.get("decision") === "deny") {
          const to = new URL(p.get("redirect_uri"));
          to.searchParams.set("error", "access_denied");
          if (p.get("state")) to.searchParams.set("state", p.get("state"));
          return redirect(res, to.toString());
        }
        return approve(res, p);
      }

      // ---- token endpoint
      if (path === "/token" && req.method === "POST") {
        const form = new URLSearchParams(await readBody(req));
        if (!clientAuth(req, form)) return send(res, 401, { error: "invalid_client" });
        const grant = form.get("grant_type");

        if (grant === "authorization_code") {
          const c = state.codes.get(form.get("code"));
          if (!c || c.used || c.exp < Date.now())
            return send(res, 400, { error: "invalid_grant" });
          c.used = true; // single use: a replayed code fails
          if (form.get("redirect_uri") !== c.redirectUri)
            return send(res, 400, {
              error: "invalid_grant",
              error_description: "redirect_uri mismatch",
            });
          if (
            !form.get("code_verifier") ||
            sha256url(form.get("code_verifier")) !== c.challenge
          ) {
            return send(res, 400, {
              error: "invalid_grant",
              error_description: "PKCE verification failed",
            });
          }
          const refresh = rand();
          state.refresh.set(refresh, { sid: c.sid, scope: c.scope, used: false });
          state.log.push({ type: "token_code", sid: c.sid });
          return send(res, 200, {
            token_type: "Bearer",
            access_token: await accessTokenFor(c.sid, c.scope),
            id_token: await idTokenFor(c.sid, c.nonce),
            refresh_token: refresh,
            expires_in: o.accessTtl,
            scope: c.scope,
          });
        }

        if (grant === "refresh_token") {
          const r = state.refresh.get(form.get("refresh_token"));
          if (!r || r.used || !state.sessions.has(r.sid))
            return send(res, 400, { error: "invalid_grant" });
          r.used = true; // rotation: the old refresh token cannot be used again
          const next = rand();
          state.refresh.set(next, { sid: r.sid, scope: r.scope, used: false });
          state.log.push({ type: "token_refresh", sid: r.sid });
          return send(res, 200, {
            token_type: "Bearer",
            access_token: await accessTokenFor(r.sid, r.scope),
            id_token: await idTokenFor(r.sid, undefined),
            refresh_token: next,
            expires_in: o.accessTtl,
            scope: r.scope,
          });
        }
        return send(res, 400, { error: "unsupported_grant_type" });
      }

      // ---- end session (RP-initiated logout)
      if (path === "/logout") {
        const hint = url.searchParams.get("id_token_hint");
        let sid;
        if (hint) {
          try {
            sid = JSON.parse(Buffer.from(hint.split(".")[1], "base64url").toString()).sid;
          } catch {
            /* ignore a malformed hint */
          }
        }
        if (sid) state.sessions.delete(sid);
        state.log.push({
          type: "logout",
          sid,
          clientId: url.searchParams.get("client_id"),
        });
        const back = url.searchParams.get("post_logout_redirect_uri");
        return back
          ? redirect(res, back)
          : send(res, 200, "<p>Logged out of the mock IdP.</p>");
      }

      // ---- test helpers
      if (path === "/dev/mint" && req.method === "POST") {
        // body: { aud, scope, sub, expiresIn, iss, wrongKey }
        const b = JSON.parse((await readBody(req)) || "{}");
        const claims = {
          sub: b.sub ?? o.user.sub,
          aud: b.aud ?? o.audience,
          scope: b.scope ?? o.scope,
          email: o.user.email,
        };
        if (b.iss) claims.iss = b.iss;
        const token = await sign(claims, {
          key: b.wrongKey ? other.privateKey : privateKey,
          expiresIn: b.expiresIn ?? o.accessTtl,
          typ: "at+jwt",
        });
        return send(res, 200, { access_token: token });
      }
      if (path === "/dev/logout-token" && req.method === "POST") {
        const b = JSON.parse((await readBody(req)) || "{}");
        const token = await sign(
          {
            aud: o.clientId,
            sub: b.sub ?? o.user.sub,
            sid: b.sid,
            events: { "http://schemas.openid.net/event/backchannel-logout": {} },
            ...(b.nonce ? { nonce: b.nonce } : {}),
          },
          { expiresIn: 120 },
        );
        return send(res, 200, { logout_token: token });
      }
      if (path === "/dev/state") {
        return send(res, 200, { log: state.log, sessions: [...state.sessions] });
      }

      return send(res, 404, { error: "not_found" });
    } catch (e) {
      return send(res, 500, { error: "server_error", message: String(e?.message ?? e) });
    }
  });

  await new Promise((resolve) => server.listen(o.port, resolve));
  const port = server.address().port;
  issuer = o.issuer ?? `http://localhost:${port}`;

  return {
    issuer,
    port,
    options: o,
    state,
    // Expire every access token from now on at once (tests): tokens are minted
    // with accessTtl, so tests usually just start the IdP with a tiny accessTtl.
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// ---- CLI: node scripts/mock-idp.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 9000);
  const idp = await startMockIdp({
    port,
    issuer: process.env.ISSUER ?? `http://localhost:${port}`,
    clientId: process.env.CLIENT_ID ?? "ibe-web",
    clientSecret: process.env.CLIENT_SECRET ?? "dev-secret",
    redirectUris: (
      process.env.REDIRECT_URIS ?? "http://localhost:3000/auth/callback"
    ).split(","),
    audience: process.env.AUDIENCE ?? "ibe-api",
    accessTtl: Number(process.env.ACCESS_TTL ?? 300),
    autoApprove: process.env.AUTO_APPROVE === "1",
  });
  console.log(`Mock IdP listening on ${idp.issuer}`);
  console.log(
    `  client_id=${idp.options.clientId}  client_secret=${idp.options.clientSecret}  audience=${idp.options.audience}`,
  );
  console.log(`  redirect URIs: ${idp.options.redirectUris.join(", ")}`);
}
