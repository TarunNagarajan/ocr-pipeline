import {
  derivePresentationProof,
  randomToken,
  sha256Base64Url,
  signCredential,
  verifyPresentationProof,
  type BbsKeyPair
} from "@secure-credential/crypto";
import { claimOrder, type ClaimName, type CredentialEnvelope, type CredentialListItem, type VerifiablePresentation } from "@secure-credential/types";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { audit } from "../audit.js";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { decryptJson, encryptJson } from "../security.js";
import { issueCredentialSchema, shareCredentialSchema, verifyPresentationSchema } from "../validators.js";

export const credentialRouter = Router();

const issuerKeyPair: BbsKeyPair = {
  publicKey: Buffer.from(config.ISSUER_PUBLIC_KEY_BASE64URL, "base64url"),
  secretKey: Buffer.from(config.ISSUER_SECRET_KEY_BASE64URL, "base64url")
};

credentialRouter.post("/credentials/issue", requireAuth, async (req, res, next) => {
  try {
    const body = issueCredentialSchema.parse(req.body);
    const credentialId = randomUUID();
    const now = new Date().toISOString();
    const envelope: CredentialEnvelope = {
      schemaVersion: "credential-v1",
      credentialId,
      holderSubject: sha256Base64Url(req.user!.id),
      issuerKeyId: config.ISSUER_KEY_ID,
      issuedAt: now,
      nonce: randomToken(24),
      claims: body.claims
    };
    const signed = await signCredential(envelope, issuerKeyPair);

    await prisma.credential.create({
      data: {
        id: credentialId,
        ownerId: req.user!.id,
        encryptedPayload: encryptJson(envelope),
        signatureBase64Url: signed.signatureBase64Url,
        issuerKeyId: config.ISSUER_KEY_ID,
        schemaVersion: envelope.schemaVersion
      }
    });

    await audit(req, "credential.issue", req.user!.id, { credentialId });
    return res.status(201).json({ credential: toListItem(envelope, "ACTIVE") });
  } catch (error) {
    return next(error);
  }
});

credentialRouter.get("/credentials", requireAuth, async (req, res, next) => {
  try {
    const credentials = await prisma.credential.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: "desc" }
    });

    return res.json({
      credentials: credentials.map((credential) =>
        toListItem(decryptJson<CredentialEnvelope>(credential.encryptedPayload), credential.status)
      )
    });
  } catch (error) {
    return next(error);
  }
});

credentialRouter.post("/credentials/share", requireAuth, async (req, res, next) => {
  try {
    const body = shareCredentialSchema.parse(req.body);
    const uniqueFields = [...new Set(body.fields)] as ClaimName[];
    const credential = await prisma.credential.findFirst({
      where: { id: body.credentialId, ownerId: req.user!.id }
    });
    if (!credential || credential.status !== "ACTIVE") {
      throw new HttpError(404, "Credential not found.", "credential_not_found");
    }

    const envelope = decryptJson<CredentialEnvelope>(credential.encryptedPayload);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + body.ttlHours * 60 * 60 * 1000);
    const presentation = await derivePresentationProof({
      envelope,
      signatureBase64Url: credential.signatureBase64Url,
      publicKeyBase64Url: config.ISSUER_PUBLIC_KEY_BASE64URL,
      disclosedClaims: uniqueFields,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    const token = randomToken(32);

    await prisma.share.create({
      data: {
        credentialId: credential.id,
        ownerId: req.user!.id,
        tokenHash: sha256Base64Url(token),
        presentationJson: presentation as unknown as Prisma.InputJsonValue,
        revealedFields: uniqueFields,
        expiresAt
      }
    });

    await audit(req, "credential.share", req.user!.id, { credentialId: credential.id, fields: uniqueFields });
    return res.status(201).json({
      token,
      publicLink: `${config.WEB_ORIGIN}/verify/${token}`,
      expiresAt: expiresAt.toISOString(),
      presentation
    });
  } catch (error) {
    return next(error);
  }
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false
});

credentialRouter.get("/shares/:token", verifyLimiter, async (req, res, next) => {
  try {
    const result = await verifyShareToken(String(req.params.token), req);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

credentialRouter.delete("/shares/:token", requireAuth, async (req, res, next) => {
  try {
    const share = await prisma.share.findFirst({
      where: {
        tokenHash: sha256Base64Url(String(req.params.token)),
        ownerId: req.user!.id
      }
    });
    if (!share) {
      throw new HttpError(404, "Share link not found.", "share_not_found");
    }

    await prisma.share.update({
      where: { id: share.id },
      data: { revokedAt: new Date() }
    });
    await audit(req, "credential.share_revoked", req.user!.id, { shareId: share.id });
    return res.json({ revoked: true });
  } catch (error) {
    return next(error);
  }
});

credentialRouter.post("/credentials/verify", verifyLimiter, async (req, res, next) => {
  try {
    const body = verifyPresentationSchema.parse(req.body);
    const presentation = body.presentation as VerifiablePresentation;
    if (new Date(presentation.expiresAt).getTime() < Date.now()) {
      return res.json(toVerificationResult(presentation, false, "This presentation has expired.", "EXPIRED"));
    }

    const verified = await verifyPresentationProof(
      presentation,
      config.ISSUER_PUBLIC_KEY_BASE64URL,
      config.ISSUER_KEY_ID
    );
    return res.json(toVerificationResult(presentation, verified, verified ? "Presentation proof is valid." : "Presentation proof is invalid."));
  } catch (error) {
    return next(error);
  }
});

async function verifyShareToken(token: string, req: Parameters<typeof audit>[0]) {
  const share = await prisma.share.findUnique({
    where: { tokenHash: sha256Base64Url(token) }
  });
  if (!share) {
    throw new HttpError(404, "Share link not found.", "share_not_found");
  }

  const presentation = share.presentationJson as unknown as VerifiablePresentation;
  if (share.revokedAt) {
    await audit(req, "credential.verify_revoked", undefined, { shareId: share.id });
    return { presentation, verification: toVerificationResult(presentation, false, "This share link was revoked.", "REVOKED") };
  }

  if (share.expiresAt.getTime() < Date.now()) {
    await audit(req, "credential.verify_expired", undefined, { shareId: share.id });
    return { presentation, verification: toVerificationResult(presentation, false, "This share link has expired.", "EXPIRED") };
  }

  const verified = await verifyPresentationProof(
    presentation,
    config.ISSUER_PUBLIC_KEY_BASE64URL,
    config.ISSUER_KEY_ID
  );
  await prisma.share.update({
    where: { id: share.id },
    data: { verificationCount: { increment: 1 } }
  });
  await audit(req, verified ? "credential.verify_success" : "credential.verify_failed", undefined, { shareId: share.id });
  return {
    presentation,
    verification: toVerificationResult(
      presentation,
      verified,
      verified ? "BBS+ proof verified against the issuer public key." : "The disclosed fields or proof were tampered with."
    )
  };
}

function toListItem(envelope: CredentialEnvelope, status: "ACTIVE" | "REVOKED"): CredentialListItem {
  return {
    id: envelope.credentialId,
    issuerName: envelope.claims.issuerName,
    issueDate: envelope.claims.issueDate,
    degree: envelope.claims.degree,
    graduationYear: envelope.claims.graduationYear,
    status,
    availableFields: [...claimOrder]
  };
}

function toVerificationResult(
  presentation: VerifiablePresentation,
  verified: boolean,
  reason: string,
  forcedStatus?: "EXPIRED" | "REVOKED"
) {
  return {
    status: forcedStatus ?? (verified ? "VERIFIED" : "INVALID"),
    verified,
    reason,
    issuer: {
      keyId: presentation.issuerKeyId,
      name: presentation.issuerName
    },
    issueDate: presentation.issueDate,
    checkedAt: new Date().toISOString(),
    disclosedFields: presentation.disclosedFields,
    proofType: "BBS+ selective disclosure proof over BLS12-381"
  };
}
import type { Prisma } from "@prisma/client";
