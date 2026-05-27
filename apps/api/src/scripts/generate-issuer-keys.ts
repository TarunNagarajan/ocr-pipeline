import { generateIssuerKeyPair } from "@secure-credential/crypto";
import { randomBytes } from "node:crypto";

const keys = await generateIssuerKeyPair();

console.log(`CREDENTIAL_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`);
console.log(`JWT_SECRET=${randomBytes(48).toString("base64url")}`);
console.log(`ISSUER_PUBLIC_KEY_BASE64URL=${keys.publicKeyBase64Url}`);
console.log(`ISSUER_SECRET_KEY_BASE64URL=${keys.secretKeyBase64Url}`);
