import jwt from "jsonwebtoken";
import type { SessionClaims, User } from "../types/auth.js";

const DEV_SECRET = "dev-only-insecure-secret";

const secret = process.env.JWT_SECRET || DEV_SECRET;

// Signing production sessions with a secret that's printed in this file would
// let anyone mint a valid token, so fail at startup instead of at 3am.
if (process.env.NODE_ENV === "production" && secret === DEV_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

/** Token lifetime in seconds. Returned to callers so a cookie can match it. */
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS) || 60 * 60 * 8;

export function signSessionToken(user: User): string {
  const claims: SessionClaims = { sub: user.id, email: user.email, name: user.name };
  return jwt.sign(claims, secret, { expiresIn: SESSION_TTL_SECONDS });
}

/** Returns the claims for a valid, unexpired token, or null for anything else. */
export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, secret);
    return typeof payload === "string" ? null : (payload as SessionClaims);
  } catch {
    // Expired, tampered with, or signed by someone else — all the same to a
    // caller, and none of them worth distinguishing in a response.
    return null;
  }
}
