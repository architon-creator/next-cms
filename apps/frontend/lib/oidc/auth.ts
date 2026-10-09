import { cookies } from "next/headers";

import { oidcConfig, SESSION_COOKIE_NAME } from "./config";
import { tokenRequest } from "./oidc";
import { getSessionStore, type Session } from "./session-store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * The logged-in session for this request, or null. The cookie only holds a
 * random id; the real check is the lookup in the session store, so a forged or
 * revoked cookie is simply "logged out".
 */
export async function currentSession(): Promise<{ id: string; s: Session } | null> {
  const id = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!id) return null;
  const store = getSessionStore();
  const s = await store.get(id);
  if (!s) return null;
  if (nowSeconds() - s.createdAt > oidcConfig().sessionMaxAge) {
    await store.delete(id); // absolute lifetime reached, however active the user was
    return null;
  }
  return { id, s };
}

/** Returns a valid access token, refreshing it if needed. Null means: log in again. */
export async function validAccessToken(id: string, s: Session): Promise<string | null> {
  const now = nowSeconds();
  if (s.accessExp - 30 > now) return s.accessToken;
  if (!s.refreshToken) return null;

  const store = getSessionStore();
  // If the vendor rotates refresh tokens, two parallel requests must not both
  // refresh: the second would present an already-used token and fail. One
  // request takes a short lock, the others wait for its result.
  if (!(await store.tryLock(`refresh:${id}`, 10))) {
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      const again = await store.get(id);
      if (again && again.accessExp - 30 > nowSeconds()) return again.accessToken;
    }
    return null;
  }

  try {
    const t = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: s.refreshToken,
    });
    const updated: Session = {
      ...s,
      accessToken: t.access_token,
      accessExp: nowSeconds() + (t.expires_in ?? 300),
      refreshToken: t.refresh_token ?? s.refreshToken, // vendors may rotate it
      idToken: t.id_token ?? s.idToken,
    };
    await store.save(id, updated);
    return updated.accessToken;
  } catch {
    await store.delete(id); // refresh rejected: the session is over
    return null;
  } finally {
    await store.unlock(`refresh:${id}`);
  }
}
