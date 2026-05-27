import argon2 from "argon2";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { audit } from "../audit.js";
import { setSessionCookie, signSession } from "../auth.js";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { loginSchema, registerSchema } from "../validators.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

authRouter.use(authLimiter);

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, "An account with this email already exists.", "email_in_use");
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await argon2.hash(body.password, { type: argon2.argon2id })
      },
      select: { id: true, email: true }
    });
    await audit(req, "auth.register", user.id);
    setSessionCookie(res, signSession(user));
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await argon2.verify(user.passwordHash, body.password))) {
      await audit(req, "auth.login_failed", undefined, { email: body.email });
      throw new HttpError(401, "Invalid email or password.", "invalid_credentials");
    }

    const sessionUser = { id: user.id, email: user.email };
    await audit(req, "auth.login", user.id);
    setSessionCookie(res, signSession(sessionUser));
    return res.json({ user: sessionUser });
  } catch (error) {
    return next(error);
  }
});

