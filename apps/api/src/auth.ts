import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "./errors.js";
import { config, isProduction } from "./config.js";

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const cookieName = "credential_session";

export function signSession(user: AuthUser): string {
  return jwt.sign(user, config.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "2h",
    issuer: "secure-credential-sharing",
    audience: "secure-credential-holder"
  });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/"
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = req.cookies?.[cookieName] ?? bearer;
  if (!token) {
    return next(new HttpError(401, "Authentication is required.", "unauthenticated"));
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "secure-credential-sharing",
      audience: "secure-credential-holder"
    }) as AuthUser;
    return next();
  } catch {
    return next(new HttpError(401, "Authentication is required.", "unauthenticated"));
  }
}
