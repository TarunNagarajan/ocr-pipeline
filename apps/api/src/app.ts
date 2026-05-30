import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttpModule from "pino-http";
import { authRouter } from "./routes/auth.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { config } from "./config.js";
import { errorHandler } from "./errors.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  const pinoHttp = pinoHttpModule as unknown as () => express.RequestHandler;
  app.use(pinoHttp());
  app.use(helmet());
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
