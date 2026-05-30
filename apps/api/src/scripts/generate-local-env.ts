import { randomBytes } from "node:crypto";

console.log(`DOCUMENT_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`);
console.log(`JWT_SECRET=${randomBytes(48).toString("base64url")}`);
