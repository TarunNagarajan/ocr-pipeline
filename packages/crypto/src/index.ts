import {
  blsCreateProof,
  blsSign,
  blsVerify,
  blsVerifyProof,
  generateBls12381G2KeyPair
} from "@mattrglobal/bbs-signatures";
import { claimOrder, type ClaimName, type CredentialEnvelope, type VerifiablePresentation } from "@secure-credential/types";
import { createHash, randomBytes } from "node:crypto";

export interface BbsKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface SignedCredential {
  envelope: CredentialEnvelope;
  signatureBase64Url: string;
  messageLabels: string[];
}

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function buildCredentialMessages(envelope: CredentialEnvelope): { labels: string[]; messages: Uint8Array[] } {
  const pairs: Array<[string, unknown]> = [
    ["meta:schemaVersion", envelope.schemaVersion],
    ["meta:credentialId", envelope.credentialId],
    ["meta:holderSubject", envelope.holderSubject],
    ["meta:issuerKeyId", envelope.issuerKeyId],
    ["meta:issuerName", envelope.claims.issuerName],
    ["meta:issueDate", envelope.claims.issueDate],
    ["meta:issuedAt", envelope.issuedAt],
    ["meta:nonce", envelope.nonce],
    ...claimOrder.map((claim) => [`claim:${claim}`, envelope.claims[claim]] as [string, unknown])
  ];

  return {
    labels: pairs.map(([label]) => label),
    messages: pairs.map(([label, value]) => encoder.encode(`${label}\u0000${canonicalJson(value)}`))
  };
}

export function messageIndexesForClaims(claims: ClaimName[]): number[] {
  const requiredMetaIndexes = [0, 1, 3, 4, 5, 6, 7];
  const uniqueClaims = [...new Set(claims)];
  const claimIndexes = uniqueClaims.map((claim) => 8 + claimOrder.indexOf(claim));
  return [...requiredMetaIndexes, ...claimIndexes].sort((a, b) => a - b);
}

export async function generateIssuerKeyPair(): Promise<{ publicKeyBase64Url: string; secretKeyBase64Url: string }> {
  const keyPair = await generateBls12381G2KeyPair();
  return {
    publicKeyBase64Url: toBase64Url(keyPair.publicKey),
    secretKeyBase64Url: toBase64Url(keyPair.secretKey)
  };
}

export async function signCredential(envelope: CredentialEnvelope, keyPair: BbsKeyPair): Promise<SignedCredential> {
  const { labels, messages } = buildCredentialMessages(envelope);
  const signature = await blsSign({ keyPair, messages });
  return {
    envelope,
    signatureBase64Url: toBase64Url(signature),
    messageLabels: labels
  };
}

export async function verifyCredentialSignature(
  envelope: CredentialEnvelope,
  signatureBase64Url: string,
  publicKeyBase64Url: string
): Promise<boolean> {
  const { messages } = buildCredentialMessages(envelope);
  const result = await blsVerify({
    publicKey: fromBase64Url(publicKeyBase64Url),
    messages,
    signature: fromBase64Url(signatureBase64Url)
  });
  return result.verified;
}

export async function derivePresentationProof(params: {
  envelope: CredentialEnvelope;
  signatureBase64Url: string;
  publicKeyBase64Url: string;
  disclosedClaims: ClaimName[];
  expiresAt: string;
  createdAt: string;
}): Promise<VerifiablePresentation> {
  const { messages } = buildCredentialMessages(params.envelope);
  const revealedIndexes = messageIndexesForClaims(params.disclosedClaims);
  const presentationNonce = randomToken(24);
  const nonce = presentationNonceFor({
    credentialId: params.envelope.credentialId,
    issuerKeyId: params.envelope.issuerKeyId,
    issuerName: params.envelope.claims.issuerName,
    issueDate: params.envelope.claims.issueDate,
    issuedAt: params.envelope.issuedAt,
    credentialNonce: params.envelope.nonce,
    createdAt: params.createdAt,
    expiresAt: params.expiresAt,
    disclosedClaims: params.disclosedClaims,
    presentationNonce
  });
  const proof = await blsCreateProof({
    signature: fromBase64Url(params.signatureBase64Url),
    publicKey: fromBase64Url(params.publicKeyBase64Url),
    messages,
    nonce: encoder.encode(nonce),
    revealed: revealedIndexes
  });

  return {
    type: "BbsSelectiveDisclosurePresentation",
    schemaVersion: "presentation-v1",
    credentialId: params.envelope.credentialId,
    issuerKeyId: params.envelope.issuerKeyId,
    issuerName: params.envelope.claims.issuerName,
    issueDate: params.envelope.claims.issueDate,
    issuedAt: params.envelope.issuedAt,
    credentialNonce: params.envelope.nonce,
    createdAt: params.createdAt,
    expiresAt: params.expiresAt,
    nonce,
    presentationNonce,
    revealedIndexes,
    disclosedFields: params.disclosedClaims.map((name) => ({
      name,
      value: params.envelope.claims[name],
      trust: "cryptographically-bound"
    })),
    proofBase64Url: toBase64Url(proof),
    publicKeyBase64Url: params.publicKeyBase64Url
  };
}

export async function verifyPresentationProof(
  presentation: VerifiablePresentation,
  trustedPublicKeyBase64Url?: string,
  trustedIssuerKeyId?: string
): Promise<boolean> {
  if (trustedIssuerKeyId && presentation.issuerKeyId !== trustedIssuerKeyId) {
    return false;
  }

  const disclosedClaims = presentation.disclosedFields.map((field) => field.name);
  const expectedIndexes = messageIndexesForClaims(disclosedClaims);
  if (
    new Set(disclosedClaims).size !== disclosedClaims.length ||
    expectedIndexes.length !== presentation.revealedIndexes.length ||
    expectedIndexes.some((index, position) => index !== presentation.revealedIndexes[position])
  ) {
    return false;
  }

  const expectedNonce = presentationNonceFor({
    credentialId: presentation.credentialId,
    issuerKeyId: presentation.issuerKeyId,
    issuerName: presentation.issuerName,
    issueDate: presentation.issueDate,
    issuedAt: presentation.issuedAt,
    credentialNonce: presentation.credentialNonce,
    createdAt: presentation.createdAt,
    expiresAt: presentation.expiresAt,
    disclosedClaims,
    presentationNonce: presentation.presentationNonce
  });
  if (expectedNonce !== presentation.nonce) {
    return false;
  }

  const reconstructedEnvelope: CredentialEnvelope = {
    schemaVersion: "credential-v1",
    credentialId: presentation.credentialId,
    holderSubject: "__hidden__",
    issuerKeyId: presentation.issuerKeyId,
    issuedAt: presentation.issuedAt,
    nonce: presentation.credentialNonce,
    claims: Object.fromEntries(claimOrder.map((claim) => [claim, "__hidden__"])) as CredentialEnvelope["claims"]
  };

  for (const field of presentation.disclosedFields) {
    reconstructedEnvelope.claims[field.name] = field.value;
  }
  reconstructedEnvelope.claims.issuerName = presentation.issuerName;
  reconstructedEnvelope.claims.issueDate = presentation.issueDate;

  const { messages } = buildCredentialMessages(reconstructedEnvelope);
  const revealedMessages = presentation.revealedIndexes.map((index) => messages[index]);

  const result = await blsVerifyProof({
    proof: fromBase64Url(presentation.proofBase64Url),
    publicKey: fromBase64Url(trustedPublicKeyBase64Url ?? presentation.publicKeyBase64Url),
    messages: revealedMessages,
    nonce: encoder.encode(presentation.nonce)
  });
  return result.verified;
}

function presentationNonceFor(value: {
  credentialId: string;
  issuerKeyId: string;
  issuerName: string;
  issueDate: string;
  issuedAt: string;
  credentialNonce: string;
  createdAt: string;
  expiresAt: string;
  disclosedClaims: ClaimName[];
  presentationNonce: string;
}): string {
  return `sd-v1.${sha256Base64Url(canonicalJson({
    ...value,
    disclosedClaims: [...new Set(value.disclosedClaims)].sort()
  }))}`;
}
