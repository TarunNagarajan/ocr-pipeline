import { describe, expect, it } from "vitest";
import { buildEvidenceFromText, buildStructuredResult, estimateQuality } from "./index.js";

describe("document extraction pipeline", () => {
  it("extracts education credential fields from labeled text", () => {
    const rawText = [
      "Open Campus University",
      "Student Name: Asha Rao",
      "Father Name: Raj Rao",
      "Date of Birth: 14/04/2003",
      "Degree: Bachelor of Technology in Computer Science",
      "Graduation Year: 2026",
      "CGPA: 8.9",
      "Issued By: Open Campus University"
    ].join("\n");

    const evidence = buildEvidenceFromText(rawText);
    const result = buildStructuredResult({
      rawText,
      evidence,
      quality: estimateQuality(evidence, rawText)
    });

    expect(result.holder.name.value).toBe("Asha Rao");
    expect(result.holder.dob.normalizedValue).toBe("2003-04-14");
    expect(result.credential.degree.value).toContain("Bachelor of Technology");
    expect(result.credential.year.value).toBe("2026");
    expect(result.credential.cgpa.value).toBe("8.9");
    expect(result.summary.documentType).toBe("education-certificate");
    expect(result.summary.reviewBand).toBe("auto_accept");
  });

  it("marks sparse OCR output as low signal", () => {
    const rawText = "ID";
    const evidence = buildEvidenceFromText(rawText, "summary");
    const quality = estimateQuality(evidence, rawText);

    expect(quality.documentReadable).toBe(false);
    expect(quality.lowSignal).toBe(true);
  });

  it("downgrades low-signal model-only extraction to unsupported", () => {
    const rawText = "———\n——\nBE";
    const evidence = buildEvidenceFromText(rawText, "summary");
    const result = buildStructuredResult({
      rawText,
      evidence,
      quality: estimateQuality(evidence, rawText),
      documentTypeOverride: "education-certificate",
      llmOverrides: {
        degree: "Bachelor of Technology in Computer Science",
        institution: "Open Campus University",
        year: "2024",
        cgpa: "3.5"
      }
    });

    expect(result.summary.reviewBand).toBe("unsupported");
  });

  it("assigns lower default confidence to tesseract-derived text evidence", () => {
    const evidence = buildEvidenceFromText("Student Name: Asha Rao", "tesseract");
    expect(evidence[0]?.confidence).toBe(62);
  });

  it("handles identity-style documents without forcing academic fields", () => {
    const rawText = [
      "Government of India",
      "Holder Name: Priya Menon",
      "Father Name: Ravi Menon",
      "Date of Birth: 09/09/2001",
      "Issuing Authority: National Identity Office"
    ].join("\n");

    const evidence = buildEvidenceFromText(rawText);
    const result = buildStructuredResult({
      rawText,
      evidence,
      quality: estimateQuality(evidence, rawText)
    });

    expect(result.summary.documentType).toBe("identity-document");
    expect(result.holder.name.value).toBe("Priya Menon");
    expect(result.credential.degree.value).toBeNull();
    expect(result.issuer.name.value).toBe("National Identity Office");
  });

  it("handles professional certificates with non-academic labels", () => {
    const rawText = [
      "Certificate of Completion",
      "Participant Name: Dev Sharma",
      "Certification: Advanced Cloud Security Practitioner",
      "Organization: Maruthi Labs Academy",
      "Issued On: 12/03/2025",
      "Certified By: Maruthi Labs Academy"
    ].join("\n");

    const evidence = buildEvidenceFromText(rawText);
    const result = buildStructuredResult({
      rawText,
      evidence,
      quality: estimateQuality(evidence, rawText)
    });

    expect(result.summary.documentType).toBe("professional-certificate");
    expect(result.credential.degree.value).toContain("Advanced Cloud Security Practitioner");
    expect(result.credential.institution.value).toContain("Maruthi Labs Academy");
    expect(result.credential.cgpa.value).toBeNull();
  });
});
