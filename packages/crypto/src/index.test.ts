import { describe, expect, it } from "vitest";
import {
  derivePresentationProof,
  generateIssuerKeyPair,
  signCredential,
  verifyCredentialSignature,
  verifyPresentationProof,
  type BbsKeyPair,
  fromBase64Url
} from "./index.js";
import type { CredentialEnvelope } from "@secure-credential/types";

function sampleEnvelope(): CredentialEnvelope {
  return {
    schemaVersion: "credential-v1",
    credentialId: "cred-test-1",
    holderSubject: "holder-hash",
    issuerKeyId: "did:example:issuer#key-1",
    issuedAt: "2026-05-27T00:00:00.000Z",
    nonce: "credential-nonce",
    claims: {
      name: "Asha Rao",
      degree: "B.Tech Computer Science",
      graduationYear: "2026",
      cgpa: "8.9",
      marks: "891/1000",
      issuerName: "Open Campus University",
      issueDate: "2026-05-01"
    }
  };
}

describe("BBS+ selective disclosure", () => {
  it("signs credentials and verifies selectively disclosed fields", async () => {
    const keys = await generateIssuerKeyPair();
    const keyPair: BbsKeyPair = {
      publicKey: fromBase64Url(keys.publicKeyBase64Url),
      secretKey: fromBase64Url(keys.secretKeyBase64Url)
    };
    const signed = await signCredential(sampleEnvelope(), keyPair);

    await expect(
      verifyCredentialSignature(sampleEnvelope(), signed.signatureBase64Url, keys.publicKeyBase64Url)
    ).resolves.toBe(true);

    const presentation = await derivePresentationProof({
      envelope: sampleEnvelope(),
      signatureBase64Url: signed.signatureBase64Url,
      publicKeyBase64Url: keys.publicKeyBase64Url,
      disclosedClaims: ["name", "degree", "graduationYear"],
      createdAt: "2026-05-27T00:00:00.000Z",
      expiresAt: "2026-05-28T00:00:00.000Z"
    });

    expect(presentation.disclosedFields.map((field) => field.name)).toEqual(["name", "degree", "graduationYear"]);
    expect(JSON.stringify(presentation)).not.toContain("8.9");
    await expect(verifyPresentationProof(presentation)).resolves.toBe(true);
  });

  it("rejects tampered disclosed values", async () => {
    const keys = await generateIssuerKeyPair();
    const keyPair: BbsKeyPair = {
      publicKey: fromBase64Url(keys.publicKeyBase64Url),
      secretKey: fromBase64Url(keys.secretKeyBase64Url)
    };
    const envelope = sampleEnvelope();
    const signed = await signCredential(envelope, keyPair);
    const presentation = await derivePresentationProof({
      envelope,
      signatureBase64Url: signed.signatureBase64Url,
      publicKeyBase64Url: keys.publicKeyBase64Url,
      disclosedClaims: ["name"],
      createdAt: "2026-05-27T00:00:00.000Z",
      expiresAt: "2026-05-28T00:00:00.000Z"
    });

    presentation.disclosedFields[0] = { ...presentation.disclosedFields[0], value: "Mallory" };
    await expect(verifyPresentationProof(presentation)).resolves.toBe(false);
  });

  it("rejects added fields that were not revealed in the proof", async () => {
    const keys = await generateIssuerKeyPair();
    const keyPair: BbsKeyPair = {
      publicKey: fromBase64Url(keys.publicKeyBase64Url),
      secretKey: fromBase64Url(keys.secretKeyBase64Url)
    };
    const envelope = sampleEnvelope();
    const signed = await signCredential(envelope, keyPair);
    const presentation = await derivePresentationProof({
      envelope,
      signatureBase64Url: signed.signatureBase64Url,
      publicKeyBase64Url: keys.publicKeyBase64Url,
      disclosedClaims: ["name"],
      createdAt: "2026-05-27T00:00:00.000Z",
      expiresAt: "2026-05-28T00:00:00.000Z"
    });

    presentation.disclosedFields.push({ name: "degree", value: "Fake Degree", trust: "cryptographically-bound" });
    await expect(verifyPresentationProof(presentation, keys.publicKeyBase64Url, "did:example:issuer#key-1")).resolves.toBe(false);
  });

  it("rejects proofs signed by an untrusted public key", async () => {
    const trusted = await generateIssuerKeyPair();
    const attacker = await generateIssuerKeyPair();
    const attackerPair: BbsKeyPair = {
      publicKey: fromBase64Url(attacker.publicKeyBase64Url),
      secretKey: fromBase64Url(attacker.secretKeyBase64Url)
    };
    const envelope = sampleEnvelope();
    const signed = await signCredential(envelope, attackerPair);
    const presentation = await derivePresentationProof({
      envelope,
      signatureBase64Url: signed.signatureBase64Url,
      publicKeyBase64Url: attacker.publicKeyBase64Url,
      disclosedClaims: ["name"],
      createdAt: "2026-05-27T00:00:00.000Z",
      expiresAt: "2026-05-28T00:00:00.000Z"
    });

    await expect(verifyPresentationProof(presentation, trusted.publicKeyBase64Url, "did:example:issuer#key-1")).resolves.toBe(false);
  });
});
