import type { NextFunction, Request, Response } from "express";
import type { SessionClaims } from "../types/auth.js";
import { verifySessionToken } from "../lib/tokens.js";

// Lets downstream handlers read req.session without casting at each use site.
declare global {
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

/**
 * Rejects the request unless it carries a valid `Authorization: Bearer <jwt>`
 * header, and attaches the decoded claims as `req.session` when it does.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const claims = verifySessionToken(token);
  if (!claims) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.session = claims;
  next();
}
