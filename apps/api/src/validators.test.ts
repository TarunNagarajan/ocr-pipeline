import { describe, expect, it } from "vitest";
import { issueCredentialSchema, shareCredentialSchema } from "./validators.js";

describe("API validation", () => {
  it("accepts a complete credential issue request", () => {
    expect(() =>
      issueCredentialSchema.parse({
        claims: {
          name: "Asha Rao",
          degree: "B.Tech Computer Science",
          graduationYear: "2026",
          cgpa: "8.9",
          marks: "891/1000",
          issuerName: "Open Campus University",
          issueDate: "2026-05-01"
        }
      })
    ).not.toThrow();
  });

  it("rejects invalid share fields and unsafe TTL values", () => {
    expect(() =>
      shareCredentialSchema.parse({
        credentialId: "cred-1",
        fields: ["name", "unknown"],
        ttlHours: 999
      })
    ).toThrow();
  });
});
