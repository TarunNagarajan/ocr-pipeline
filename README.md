# Secure Credential Sharing Module

Production-grade implementation of the internship assessment Problem 1: selective disclosure and verification for digital credentials.

The system lets a holder issue a signed credential, reveal only selected fields, and give a verifier a public link or QR code. The verifier sees only the disclosed fields and validates a BBS+ selective-disclosure proof over BLS12-381.

## Architecture

- `apps/web`: Next.js, TypeScript, Tailwind frontend.
- `apps/api`: Express, TypeScript, Prisma API.
- `packages/crypto`: BBS+ signing, proof derivation, proof verification, canonicalization helpers.
- `packages/types`: shared credential and verification types.
- Database: PostgreSQL, intended for Neon locally or in production.

Credential data is encrypted at rest with AES-256-GCM. Passwords are hashed with Argon2id. Sessions use JWTs in HTTP-only cookies. Verification endpoints are public but rate-limited.

## Selective Disclosure Design

This project uses `@mattrglobal/bbs-signatures` for real multi-message BBS+ signatures.

When a credential is issued, the backend canonicalizes each metadata and claim field into deterministic signed messages. The issuer signs the full message set once. When the holder shares a credential, the backend derives a proof that reveals only mandatory metadata and the selected fields. Hidden fields are not included in the presentation or verifier response.

Verifier checks include:

- Share token exists and is not expired or revoked.
- BBS+ proof verifies against the issuer public key.
- Displayed disclosed field values match the signed revealed messages.
- Tampered proof bytes or changed field values fail verification.

This is intentionally stronger than filtering JSON. Filtering is only used after proof derivation for display.

## Local Setup

Install dependencies:

```bash
npm install
```

Generate demo secrets:

```bash
npm run keys -w apps/api
```

Copy `.env.example` to `.env` and paste generated values. Start PostgreSQL with Docker if available:

```bash
docker compose up -d
```

Apply the schema:

```bash
npm run prisma:migrate -w apps/api
```

Run both apps:

```bash
npm run dev
```

Open `http://localhost:3000`. The API runs on `http://localhost:4000`.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string.
- `WEB_ORIGIN`: frontend origin allowed by CORS.
- `API_PUBLIC_URL`: public API URL.
- `NEXT_PUBLIC_API_URL`: browser-facing API URL.
- `JWT_SECRET`: at least 32 random bytes.
- `CREDENTIAL_ENCRYPTION_KEY`: 32-byte base64url key preferred.
- `ISSUER_KEY_ID`: stable issuer key identifier.
- `ISSUER_NAME`: demo issuer display name.
- `ISSUER_PUBLIC_KEY_BASE64URL`: BLS12-381 issuer public key.
- `ISSUER_SECRET_KEY_BASE64URL`: BLS12-381 issuer private key.
- `BBS_SIGNATURES_MODE`: set to `WASM` for portable deployment.

## API

### Authentication

`POST /api/auth/register`

```json
{ "email": "holder@example.com", "password": "minimum10chars" }
```

`POST /api/auth/login`

```json
{ "email": "holder@example.com", "password": "minimum10chars" }
```

### Credential Management

`POST /api/credentials/issue`

Requires auth cookie.

```json
{
  "claims": {
    "name": "Asha Rao",
    "degree": "B.Tech Computer Science",
    "graduationYear": "2026",
    "cgpa": "8.9",
    "marks": "891/1000",
    "issuerName": "Open Campus University",
    "issueDate": "2026-05-01"
  }
}
```

`GET /api/credentials`

Returns credentials belonging to the logged-in holder.

### Selective Sharing

`POST /api/credentials/share`

Requires auth cookie.

```json
{
  "credentialId": "credential-id",
  "fields": ["name", "degree", "graduationYear"],
  "ttlHours": 24
}
```

Returns a public link, expiry timestamp, token, and verifiable presentation.

### Verification

`GET /api/shares/:token`

Public endpoint used by the verifier page. Returns the presentation and verification result.

`POST /api/credentials/verify`

```json
{ "presentation": {} }
```

Verifies a submitted presentation without requiring a stored share token.

## Security Controls

- Argon2id password hashing.
- JWT sessions stored in HTTP-only cookies.
- CORS allowlist with credential support.
- Helmet security headers.
- Request size limits.
- Zod validation on all payloads.
- Rate limits on auth and verification endpoints.
- AES-256-GCM encryption for full credential payloads.
- Token hashes stored instead of raw share tokens.
- Audit events for auth, issue, share, and verification actions.
- No full credential is returned to public verifier endpoints.

## Tests

Run all tests:

```bash
npm test
```

The crypto tests cover:

- Full credential signature verification.
- Selective disclosure proof verification.
- Hidden field non-disclosure.
- Tampered disclosed field rejection.

## Deployment

Recommended free deployment:

- Frontend: Vercel.
- Backend: Render web service.
- Database: Neon PostgreSQL.

Deploy steps:

1. Create a Neon database and copy `DATABASE_URL`.
2. Deploy `apps/api` on Render with build command `npm install && npm run build -w packages/types && npm run build -w packages/crypto && npm run build -w apps/api` and start command `npm run start -w apps/api`.
3. Set API environment variables on Render.
4. Deploy `apps/web` on Vercel with `NEXT_PUBLIC_API_URL` set to the Render API URL.
5. Set `WEB_ORIGIN` on Render to the Vercel URL.
6. Run Prisma migration against Neon before demo.

## Demo Script

1. Explain why Problem 1 was chosen: deterministic security depth, privacy, and assessable cryptography.
2. Register as a holder.
3. Issue a credential with private fields such as CGPA and marks.
4. Share only name, degree, and graduation year.
5. Open the QR/public link and show that hidden fields are absent.
6. Explain the BBS+ proof flow and why tampering fails.
7. Show tests proving valid and tampered proof behavior.

## Improvements With More Time

- Add KMS or HSM-backed issuer key custody.
- Add issuer key rotation and revocation registry.
- Add DID document resolution instead of static issuer keys.
- Add holder-side wallet encryption using a passkey-derived key.
- Add WebAuthn login and device-bound sessions.
- Add formal OpenAPI generation and a hosted Swagger page.
