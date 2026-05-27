import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

function encryptionKey(): Buffer {
  const decoded = Buffer.from(config.CREDENTIAL_ENCRYPTION_KEY, "base64url");
  if (decoded.length === 32) {
    return decoded;
  }
  return createHash("sha256").update(config.CREDENTIAL_ENCRYPTION_KEY).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptJson<T>(payload: string): T {
  const [ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function hashAuditValue(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return createHash("sha256").update(value).digest("base64url");
}
