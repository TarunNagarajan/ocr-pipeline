import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { config } from "./config.js";

export interface SavedUpload {
  absolutePath: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
}

const originalsDir = resolve(config.STORAGE_ROOT, "originals");
let cachedStorageClient: any | null = null;

export async function ensureStorage() {
  if (config.STORAGE_BACKEND === "gcs") {
    if (!config.GCS_BUCKET) {
      throw new Error("GCS_BUCKET is required when STORAGE_BACKEND=gcs.");
    }
    await getGcsBucket();
    return;
  }
  await mkdir(originalsDir, { recursive: true });
}

async function getGcsBucket() {
  if (!config.GCS_BUCKET) {
    throw new Error("GCS_BUCKET is required when STORAGE_BACKEND=gcs.");
  }
  if (!cachedStorageClient) {
    const { Storage } = await import("@google-cloud/storage");
    cachedStorageClient = new Storage();
  }
  return cachedStorageClient.bucket(config.GCS_BUCKET);
}

export function fileExtension(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  return ext || "";
}

export async function persistUpload(documentId: string, fileName: string, buffer: Buffer): Promise<SavedUpload> {
  await ensureStorage();
  const extension = fileExtension(fileName);
  const safeExtension = extension.slice(0, 12).replace(/[^a-z0-9.]/gi, "") || ".bin";
  const relativePath = join("originals", `${documentId}${safeExtension}`);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  if (config.STORAGE_BACKEND === "gcs") {
    const bucket = await getGcsBucket();
    const file = bucket.file(relativePath.replace(/\\/g, "/"));
    await file.save(buffer, {
      resumable: false,
      validation: false,
      metadata: {
        metadata: {
          documentId,
          originalFileName: fileName,
          sha256
        }
      }
    });
    return {
      absolutePath: `gs://${config.GCS_BUCKET}/${relativePath.replace(/\\/g, "/")}`,
      relativePath: relativePath.replace(/\\/g, "/"),
      sha256,
      sizeBytes: buffer.byteLength
    };
  }

  const absolutePath = resolve(config.STORAGE_ROOT, relativePath);
  await writeFile(absolutePath, buffer);
  return {
    absolutePath,
    relativePath,
    sha256,
    sizeBytes: buffer.byteLength
  };
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  if (config.STORAGE_BACKEND === "gcs") {
    const bucket = await getGcsBucket();
    const [buffer] = await bucket.file(relativePath.replace(/\\/g, "/")).download();
    return buffer;
  }
  return readFile(resolve(config.STORAGE_ROOT, relativePath));
}

export async function fileExists(relativePath: string): Promise<boolean> {
  if (config.STORAGE_BACKEND === "gcs") {
    try {
      const bucket = await getGcsBucket();
      const [exists] = await bucket.file(relativePath.replace(/\\/g, "/")).exists();
      return exists;
    } catch {
      return false;
    }
  }
  try {
    await stat(resolve(config.STORAGE_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

export function toStorageUri(relativePath: string) {
  if (config.STORAGE_BACKEND === "gcs" && config.GCS_BUCKET) {
    return `gs://${config.GCS_BUCKET}/${relativePath.replace(/\\/g, "/")}`;
  }
  return null;
}
