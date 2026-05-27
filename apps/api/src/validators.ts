import { claimOrder } from "@secure-credential/types";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10).max(128)
});

export const loginSchema = registerSchema;

export const issueCredentialSchema = z.object({
  claims: z.object({
    name: z.string().trim().min(1).max(120),
    degree: z.string().trim().min(1).max(120),
    graduationYear: z.string().trim().regex(/^\d{4}$/),
    cgpa: z.string().trim().min(1).max(12),
    marks: z.string().trim().min(1).max(40),
    issuerName: z.string().trim().min(1).max(120),
    issueDate: z.string().trim().min(4).max(30)
  })
});

export const shareCredentialSchema = z.object({
  credentialId: z.string().min(1),
  fields: z.array(z.enum(claimOrder)).min(1).max(claimOrder.length),
  ttlHours: z.coerce.number().int().min(1).max(168).default(24)
});

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const isoDateSchema = z.string().datetime();

export const presentationSchema = z.object({
  type: z.literal("BbsSelectiveDisclosurePresentation"),
  schemaVersion: z.literal("presentation-v1"),
  credentialId: z.string().min(1).max(200),
  issuerKeyId: z.string().min(1).max(200),
  issuerName: z.string().min(1).max(200),
  issueDate: z.string().min(1).max(40),
  issuedAt: isoDateSchema,
  credentialNonce: z.string().min(1).max(200),
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema,
  nonce: z.string().min(1).max(200),
  presentationNonce: z.string().min(1).max(200),
  revealedIndexes: z.array(z.number().int().min(0).max(32)).min(1).max(32),
  disclosedFields: z
    .array(
      z.object({
        name: z.enum(claimOrder),
        value: z.string().min(1).max(500),
        trust: z.literal("cryptographically-bound")
      })
    )
    .min(1)
    .max(claimOrder.length),
  proofBase64Url: base64UrlSchema,
  publicKeyBase64Url: base64UrlSchema
});

export const verifyPresentationSchema = z.object({
  presentation: presentationSchema
});
