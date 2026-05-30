import { resolve } from "node:path";
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
  DOCUMENT_ENCRYPTION_KEY: z.string().min(32).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
  STORAGE_ROOT: z.string().default(resolve(process.cwd(), "storage")),
  STORAGE_BACKEND: z.enum(["local", "gcs"]).default("local"),
  GCS_BUCKET: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(12),
  LLM_MODE: z.enum(["none", "openai-compatible", "vertex-ai"]).default("none"),
  VLM_MODE: z.enum(["none", "vertex-ai"]).default("none"),
  OPENAI_COMPAT_BASE_URL: z.string().url().optional(),
  OPENAI_COMPAT_MODEL: z.string().optional(),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("global"),
  VERTEX_LLM_MODEL: z.string().default("gemini-2.5-pro"),
  VERTEX_VLM_MODEL: z.string().default("gemini-2.5-pro")
});

const parsed = envSchema.parse(process.env);

export const config = {
  ...parsed,
  DOCUMENT_ENCRYPTION_KEY: parsed.DOCUMENT_ENCRYPTION_KEY ?? parsed.CREDENTIAL_ENCRYPTION_KEY ?? parsed.JWT_SECRET
};

export const isProduction = config.NODE_ENV === "production";
