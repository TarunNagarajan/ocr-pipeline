import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttpModule from "pino-http";
import { authRouter } from "./routes/auth.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { config } from "./config.js";
import { errorHandler } from "./errors.js";

// Most post-GPT software misses the point entirely by ignoring foundational security.
// We aren't here to build a flashy toy; we're here to build a hardened pipeline. 
// Rate limiting and helmet provide the deterministic grounding our API surface needs 
// before we even think about touching the VLM logic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. You are mis-incentivizing the server." }
});

export function createApp() {
  const app = express();

  // Trusting the proxy is necessary for rate limiting behind Cloud Run's load balancer.
  app.set("trust proxy", 1);
  const pinoHttp = pinoHttpModule as unknown as () => express.RequestHandler;
  
  app.use(pinoHttp());
  app.use(helmet());
  app.use("/api", apiLimiter);
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.use(express.json({ limit: "128kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api", documentRouter);
  app.use(errorHandler);

  return app;
}
