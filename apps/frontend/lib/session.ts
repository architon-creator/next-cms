/** Mirrors the API's `PublicUser` — the only user shape that crosses the wire. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Name of the cookie holding the API's session token.
 *
 * The token is kept in an httpOnly cookie on *this* origin and never handed to
 * client code: the browser talks only to this app's route handlers, and they
 * are the only thing that talks to the API. That keeps the token out of reach
 * of any script on the page, and means the browser never needs the API's
 * origin (so no CORS, and no third-party cookie behaviour to work around).
 */
export const SESSION_COOKIE = "session";

/**
 * Base URL of the Express API. Server-only on purpose — deliberately not
 * NEXT_PUBLIC_, because nothing in the browser should be calling the API
 * directly (see SESSION_COOKIE).
 */
export function apiBaseUrl(): string {
  return process.env.API_URL || "http://localhost:4000";
}
