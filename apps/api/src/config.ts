import { z } from "zod";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ["../../.env", ".env"] });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  JWT_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32),
  ISSUER_KEY_ID: z.string().min(1).default("did:example:university#bbs-key-1"),
  ISSUER_NAME: z.string().min(1).default("Open Campus University"),
  ISSUER_PUBLIC_KEY_BASE64URL: z.string().min(1),
  ISSUER_SECRET_KEY_BASE64URL: z.string().min(1),
  BBS_SIGNATURES_MODE: z.string().optional()
});

export const config = envSchema.parse(process.env);
export const isProduction = config.NODE_ENV === "production";
