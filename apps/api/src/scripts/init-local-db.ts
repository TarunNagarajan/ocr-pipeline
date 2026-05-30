import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error(`init-local-db only supports sqlite file URLs. Received: ${databaseUrl}`);
}

const relativePath = databaseUrl.slice("file:".length);
const databasePath = resolve(process.cwd(), "prisma", relativePath);
mkdirSync(dirname(databasePath), { recursive: true });

const sqliteModule = await import("node:sqlite");
const DatabaseSync = (sqliteModule as { DatabaseSync: new (path: string) => { exec: (sql: string) => void; close: () => void } }).DatabaseSync;
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ProcessedDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storedPath" TEXT NOT NULL,
  "previewPath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "stageLabel" TEXT NOT NULL DEFAULT 'Uploaded',
  "pageCount" INTEGER NOT NULL DEFAULT 1,
  "documentType" TEXT NOT NULL DEFAULT 'unknown',
  "reviewBand" TEXT NOT NULL DEFAULT 'needs_review',
  "summaryLine" TEXT NOT NULL DEFAULT 'Awaiting processing',
  "qualityJson" TEXT,
  "encryptedResult" TEXT,
  "warningsJson" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProcessedDocument_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "eventType" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "ProcessedDocument_ownerId_createdAt_idx" ON "ProcessedDocument"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProcessedDocument_ownerId_status_idx" ON "ProcessedDocument"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");
CREATE INDEX IF NOT EXISTS "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");
`);

db.close();
console.log(`Initialized SQLite database at ${databasePath}`);
