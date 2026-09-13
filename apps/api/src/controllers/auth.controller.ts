import type { Request, Response } from "express";
import { createLogger } from "otel/logging";
import type { LoginRequest, LoginResponse } from "../types/auth.js";
import { SESSION_TTL_SECONDS, signSessionToken } from "../lib/tokens.js";
import { findUserById, toPublicUser, verifyCredentials } from "../lib/users.js";

const logger = createLogger("api/auth/login");

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as Partial<LoginRequest>;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    // Never log the email/password — only the outcome. Deliberately
    // identical for "no such user" and "wrong password" — a distinct
    // message would turn this endpoint into an account enumerator.
    logger.warn("Login rejected");
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const body: LoginResponse = {
    token: signSessionToken(user),
    expiresIn: SESSION_TTL_SECONDS,
    user: toPublicUser(user),
  };

  logger.info("Login succeeded", { userId: user.id });

  res.json(body);
}

/** Returns the caller's own user. Requires requireAuth ahead of it. */
export function me(req: Request, res: Response) {
  const user = req.session && findUserById(req.session.sub);
  if (!user) {
    // Token verified, but its subject is gone (deleted between issue and use).
    return res.status(401).json({ error: "Session no longer valid" });
  }

  res.json(toPublicUser(user));
}

// Tokens are stateless and self-expiring, so there's nothing server-side to
// tear down — logout is the caller dropping the token. Exposed anyway so
// clients have one endpoint to call, and so this becomes the natural place to
// hook revocation (a deny-list, or DB-backed sessions) if it's ever needed.
export function logout(_req: Request, res: Response) {
  res.status(204).send();
}
