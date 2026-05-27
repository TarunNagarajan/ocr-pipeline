export const claimOrder = [
  "name",
  "degree",
  "graduationYear",
  "cgpa",
  "marks",
  "issuerName",
  "issueDate"
] as const;

export type ClaimName = (typeof claimOrder)[number];

export type CredentialClaims = Record<ClaimName, string>;

export type CredentialStatus = "ACTIVE" | "REVOKED";

export type VerificationStatus = "VERIFIED" | "INVALID" | "EXPIRED" | "REVOKED";

export interface CredentialEnvelope {
  schemaVersion: "credential-v1";
  credentialId: string;
  holderSubject: string;
  issuerKeyId: string;
  issuedAt: string;
  nonce: string;
  claims: CredentialClaims;
}

export interface CredentialListItem {
  id: string;
  issuerName: string;
  issueDate: string;
  degree: string;
  graduationYear: string;
  status: CredentialStatus;
  availableFields: ClaimName[];
}

export interface DisclosedField {
  name: ClaimName;
  value: string;
  trust: "cryptographically-bound";
}

export interface VerifiablePresentation {
  type: "BbsSelectiveDisclosurePresentation";
  schemaVersion: "presentation-v1";
  credentialId: string;
  issuerKeyId: string;
  issuerName: string;
  issueDate: string;
  issuedAt: string;
  credentialNonce: string;
  createdAt: string;
  expiresAt: string;
  nonce: string;
  presentationNonce: string;
  revealedIndexes: number[];
  disclosedFields: DisclosedField[];
  proofBase64Url: string;
  publicKeyBase64Url: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  verified: boolean;
  reason: string;
  issuer: {
    keyId: string;
    name: string;
  };
  issueDate: string;
  checkedAt: string;
  disclosedFields: DisclosedField[];
  proofType: "BBS+ selective disclosure proof over BLS12-381";
}
