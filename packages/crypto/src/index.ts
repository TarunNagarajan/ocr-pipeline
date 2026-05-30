import type {
  DocumentType,
  EvidenceBlock,
  EvidenceSource,
  ExtractionField,
  ExtractionSource,
  QualityAssessment,
  ReviewBand,
  StructuredDocumentResult,
  AuthenticityAnalysis
} from "@credential-lens/types";

interface Candidate {
  value: string;
  normalizedValue: string;
  confidence: number;
  evidenceIds: string[];
  page: number | null;
  sources: ExtractionSource[];
  reasoning: string[];
}

export interface ExtractedFieldInfo {
  key: string;
  label: string;
  value: string | null;
  type: "string" | "date" | "number" | "boolean";
  group: string;
  bbox?: number[];
}

export interface BuildResultInput {
  rawText: string;
  evidence: EvidenceBlock[];
  quality: QualityAssessment;
  llmFields?: ExtractedFieldInfo[];
  documentTypeOverride?: DocumentType;
  hardUnsupported?: boolean;
  extraWarnings?: string[];
  titleHint?: string | null;
  authenticity?: AuthenticityAnalysis;
}

const degreeKeywords = [
  "b.tech",
  "bachelor",
  "master",
  "diploma",
  "certificate",
  "degree",
  "qualification",
  "program",
  "programme",
  "course",
  "certified",
  "licensed",
  "engineering",
  "science",
  "commerce",
  "technology"
];

const institutionTokens = [
  "university",
  "college",
  "institute",
  "institution",
  "school",
  "board",
  "academy",
  "department",
  "authority",
  "council",
  "government"
];

const documentFamilySignals: Record<DocumentType, string[]> = {
  "identity-document": [
    "aadhaar",
    "passport",
    "identity",
    "government of",
    "date of birth",
    "father name",
    "guardian",
    "holder name"
  ],
  "education-certificate": [
    "this is to certify",
    "awarded",
    "degree",
    "bachelor",
    "master",
    "graduation",
    "university"
  ],
  marksheet: [
    "marksheet",
    "grade sheet",
    "marks obtained",
    "subject code",
    "semester",
    "total marks",
    "sgpa",
    "cgpa"
  ],
  "professional-certificate": [
    "certificate of completion",
    "certified",
    "licensed",
    "training",
    "professional",
    "issued by",
    "valid until",
    "completion"
  ],
  unknown: []
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeDate(value: string): string {
  const clean = normalizeWhitespace(value).replace(/[-.]/g, "/");
  const direct = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (direct) {
    const [, day, month, year] = direct;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const long = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!long) {
    return clean;
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];
  const monthIndex = monthNames.indexOf(long[2].toLowerCase());
  if (monthIndex === -1) {
    return clean;
  }
  return `${long[3]}-${String(monthIndex + 1).padStart(2, "0")}-${long[1].padStart(2, "0")}`;
}

function createEmptyField(): ExtractionField {
  return {
    value: null,
    normalizedValue: null,
    confidence: 0,
    band: "unsupported",
    evidenceIds: [],
    page: null,
    sources: [],
    reasoning: ["No supported evidence was found for this field."]
  };
}

function resolveBand(confidence: number, conflicting: boolean): ReviewBand {
  if (conflicting) {
    return "conflict";
  }
  if (confidence >= 85) {
    return "auto_accept";
  }
  if (confidence >= 45) {
    return "needs_review";
  }
  return "unsupported";
}

function toField(candidate: Candidate | null, conflicting = false): ExtractionField {
  if (!candidate) {
    return createEmptyField();
  }
  return {
    value: candidate.value,
    normalizedValue: candidate.normalizedValue,
    confidence: clampConfidence(candidate.confidence),
    band: resolveBand(candidate.confidence, conflicting),
    evidenceIds: candidate.evidenceIds,
    page: candidate.page,
    sources: candidate.sources,
    reasoning: candidate.reasoning
  };
}

function findLabeledCandidate(
  evidence: EvidenceBlock[],
  labels: string[],
  normalizer: (value: string) => string = normalizeWhitespace
): Candidate | null {
  for (const block of evidence) {
    const line = block.text;
    for (const label of labels) {
      const pattern = new RegExp(`(?:^|\\b)${label}\\s*[:\\-]\\s*(.+)$`, "i");
      const match = line.match(pattern);
      if (!match) {
        continue;
      }
      const rawValue = normalizeWhitespace(match[1]);
      if (!rawValue) {
        continue;
      }
      return {
        value: rawValue,
        normalizedValue: normalizer(rawValue),
        confidence: (block.confidence ?? 72) + 14,
        evidenceIds: [block.id],
        page: block.page,
        sources: ["label_match"],
        reasoning: [`Matched explicit label "${label}" in evidence block ${block.id}.`]
      };
    }
  }

  return null;
}

function findRegexCandidate(
  evidence: EvidenceBlock[],
  pattern: RegExp,
  source: ExtractionSource,
  reason: string,
  normalizer: (value: string) => string = normalizeWhitespace
): Candidate | null {
  for (const block of evidence) {
    const match = block.text.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const rawValue = normalizeWhitespace(match[1]);
    return {
      value: rawValue,
      normalizedValue: normalizer(rawValue),
      confidence: (block.confidence ?? 65) + 8,
      evidenceIds: [block.id],
      page: block.page,
      sources: [source],
      reasoning: [reason]
    };
  }

  return null;
}

function inferDocumentType(rawText: string): DocumentType {
  const text = rawText.toLowerCase();
  const scored = (Object.entries(documentFamilySignals) as Array<[DocumentType, string[]]>)
    .filter(([type]) => type !== "unknown")
    .map(([type, tokens]) => ({
      type,
      score: tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score === 0) {
    return "unknown";
  }
  if (scored[0].score === scored[1]?.score) {
    return "unknown";
  }
  return scored[0].type;
}

function inferInstitution(rawText: string, evidence: EvidenceBlock[], documentType: DocumentType): Candidate | null {
  const institutionLabels =
    documentType === "identity-document"
      ? ["issuing authority", "authority", "department", "government", "office"]
      : documentType === "professional-certificate"
        ? ["organization", "institution", "issuer", "issued by", "academy", "authority"]
        : ["institution", "college", "university", "board", "school", "academy"];

  const fromLabel = findLabeledCandidate(evidence, institutionLabels);
  if (fromLabel) {
    return fromLabel;
  }

  for (const block of evidence.slice(0, 8)) {
    if (institutionTokens.some((token) => block.text.toLowerCase().includes(token))) {
      const value = normalizeWhitespace(block.text);
      return {
        value,
        normalizedValue: value,
        confidence: (block.confidence ?? 60) + 10,
        evidenceIds: [block.id],
        page: block.page,
        sources: ["keyword_match"],
        reasoning: [`Header line contains institution token: ${value}.`]
      };
    }
  }

  if (rawText) {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);
    const match = lines.find((line) => institutionTokens.some((token) => line.toLowerCase().includes(token)));
    if (match) {
      return {
        value: match,
        normalizedValue: match,
        confidence: 58,
        evidenceIds: [],
        page: null,
        sources: ["document_summary"],
        reasoning: ["Derived institution from repeated organization name in the document summary."]
      };
    }
  }

  return null;
}

function inferDegree(evidence: EvidenceBlock[], documentType: DocumentType): Candidate | null {
  const degreeLabels =
    documentType === "professional-certificate"
      ? ["certificate", "certification", "qualification", "program", "programme", "course", "title"]
      : documentType === "marksheet"
        ? ["degree", "course", "programme", "program", "exam", "qualification"]
        : ["degree", "course", "programme", "program", "qualification"];

  const fromLabel = findLabeledCandidate(evidence, degreeLabels);
  if (fromLabel) {
    return fromLabel;
  }

  for (const block of evidence) {
    const lower = block.text.toLowerCase();
    if (degreeKeywords.some((token) => lower.includes(token)) && lower.length < 120) {
      const value = normalizeWhitespace(block.text);
      return {
        value,
        normalizedValue: value,
        confidence: (block.confidence ?? 62) + 10,
        evidenceIds: [block.id],
        page: block.page,
        sources: ["keyword_match"],
        reasoning: [`Detected degree keyword in evidence block ${block.id}.`]
      };
    }
  }

  return null;
}

function inferYear(evidence: EvidenceBlock[], documentType: DocumentType): Candidate | null {
  const yearLabels =
    documentType === "professional-certificate"
      ? ["issue year", "issued on", "completion year", "valid until", "year"]
      : documentType === "marksheet"
        ? ["exam year", "year of passing", "academic year", "year"]
        : ["graduation year", "year of passing", "year", "graduated"];
  const labeled = findLabeledCandidate(
    evidence,
    yearLabels,
    (value) => (value.match(/\b(19|20)\d{2}\b/)?.[0] ?? value)
  );
  if (labeled) {
    return {
      ...labeled,
      value: labeled.normalizedValue,
      normalizedValue: labeled.normalizedValue
    };
  }

  return findRegexCandidate(
    evidence,
    /\b((?:19|20)\d{2})\b/,
    "regex_match",
    "Detected a plausible four-digit year in the OCR output."
  );
}

function inferCgpa(evidence: EvidenceBlock[], documentType: DocumentType): Candidate | null {
  const labels =
    documentType === "marksheet"
      ? ["cgpa", "sgpa", "gpa", "grade point", "percentage", "score", "total percentage"]
      : ["cgpa", "gpa", "grade point", "percentage", "score"];
  const labeled = findLabeledCandidate(evidence, labels);
  if (!labeled) {
    return null;
  }
  const score = labeled.value.match(/(\d+(?:\.\d+)?)/)?.[1] ?? labeled.value;
  return {
    ...labeled,
    value: score,
    normalizedValue: score
  };
}

function inferIssuer(evidence: EvidenceBlock[], institution: Candidate | null): Candidate | null {
  const fromLabel = findLabeledCandidate(evidence, [
    "issuer",
    "issued by",
    "awarding body",
    "issuing authority",
    "certified by",
    "signed by"
  ]);
  if (fromLabel) {
    return fromLabel;
  }
  return institution;
}

function repeatedEntities(rawText: string): string[] {
  const tokens = rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 6 && /[A-Za-z]/.test(line));
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([value]) => value);
}

function hasEnoughSignal(rawText: string) {
  const letters = (rawText.match(/[A-Za-z0-9]/g) ?? []).length;
  return letters >= 24;
}

function computeOverallBand(
  fields: ExtractionField[],
  documentType: DocumentType,
  quality: QualityAssessment,
  rawText: string,
  hardUnsupported = false
): ReviewBand {
  if (hardUnsupported) {
    return "unsupported";
  }
  if (fields.some((field) => field.band === "conflict")) {
    return "conflict";
  }
  const meaningfulFields = fields.filter((field) => field.band !== "unsupported");
  const autoAcceptFields = fields.filter((field) => field.band === "auto_accept");
  const evidenceBackedFields = meaningfulFields.filter((field) => field.evidenceIds.length > 0);
  const modelOnlyFields = meaningfulFields.filter(
    (field) => field.evidenceIds.length === 0 && field.sources.some((source) => source === "llm_adjudication" || source === "vlm_extraction")
  );

  if (!hasEnoughSignal(rawText)) {
    return "unsupported";
  }
  if (quality.lowSignal && evidenceBackedFields.length < 2) {
    return "unsupported";
  }
  if (quality.lowSignal && modelOnlyFields.length >= meaningfulFields.length && meaningfulFields.length > 0) {
    return "unsupported";
  }

  if (documentType === "unknown" && meaningfulFields.length < 3) {
    return "unsupported";
  }
  if (meaningfulFields.length < 2) {
    return "unsupported";
  }
  if (autoAcceptFields.length >= 3 && !fields.some((field) => field.band === "needs_review")) {
    return "auto_accept";
  }
  if (fields.some((field) => field.band === "needs_review") || meaningfulFields.length >= 2) {
    return "needs_review";
  }
  return "unsupported";
}

export function buildStructuredResult(input: BuildResultInput): StructuredDocumentResult {
  const documentType = input.documentTypeOverride ?? inferDocumentType(input.rawText);
  const fields: Record<string, any> = {};
  const confidence: Record<string, number> = {};
  
  if (input.llmFields) {
    for (const field of input.llmFields) {
      if (!field.value) continue;
      
      const normalizedValue = field.type === "date" ? normalizeDate(field.value) : normalizeWhitespace(field.value);
      let band: ReviewBand = "needs_review";
      let evidenceIds: string[] = [];
      let spatialBboxes: number[][] | undefined = undefined;
      let sources: ExtractionSource[] = ["vlm_extraction"];
      let reasoning = ["Extracted via dynamic schema mapping."];
      let conf = 85;
      let page: number | null = null;

      if (field.bbox && Array.isArray(field.bbox) && field.bbox.length === 4) {
        spatialBboxes = [field.bbox];
        sources.push("vlm_extraction");
        reasoning = ["Spatial bounding box natively provided by Gemini Vision."];
        band = "auto_accept";
        conf = 98;
        page = 1;
      } else {
        const isDate = field.type === "date" || field.key === "dob" || field.key.includes("Date");
        const matchedCandidates = isDate 
          ? [findRegexCandidate(input.evidence, /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/, "regex_match", "Detected a date pattern.", normalizeDate)].filter(Boolean)
          : [findLabeledCandidate(input.evidence, [field.label.toLowerCase(), field.key.toLowerCase()])].filter(Boolean);

        if (matchedCandidates.length > 0 && matchedCandidates[0] && matchedCandidates[0].value) {
           evidenceIds = matchedCandidates[0].evidenceIds;
           sources = [...matchedCandidates[0].sources, "vlm_extraction"];
           reasoning = [...matchedCandidates[0].reasoning, "Validated against OCR evidence."];
           band = "auto_accept";
           conf = 95;
           page = matchedCandidates[0].page;
        }
      }

      fields[field.key] = {
        label: field.label,
        type: field.type,
        group: field.group,
        value: field.value,
        normalizedValue,
        confidence: conf,
        band,
        evidenceIds,
        spatialBboxes,
        page,
        sources,
        reasoning
      };
      confidence[field.key] = conf;
    }
  }

  const warnings = [...input.quality.notes, ...(input.extraWarnings ?? [])];
  if (input.rawText.length < 30) {
    warnings.push("Very little text was extracted from the document.");
  }
  if (documentType === "unknown") {
    warnings.push("The system could not confidently classify the document family.");
  }

  return {
    fields,
    confidence,
    rawText: input.rawText,
    warnings,
    summary: {
      documentType,
      titleLines: input.titleHint
        ? [input.titleHint]
        : input.rawText
            .split(/\r?\n/)
            .map((line) => normalizeWhitespace(line))
            .filter(Boolean)
            .slice(0, 4),
      repeatedEntities: repeatedEntities(input.rawText),
      reviewBand: computeOverallBand(Object.values(fields), documentType, input.quality, input.rawText, input.hardUnsupported)
    },
    authenticity: input.authenticity,
    evidence: input.evidence,
    quality: input.quality
  };
}

export function buildEvidenceFromText(
  text: string,
  source: EvidenceSource = "pdf-text",
  page = 1
): EvidenceBlock[] {
  const defaultConfidence =
    source === "summary" ? 55 : source === "tesseract" ? 62 : source === "pdf-text" ? 88 : 70;
  return text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .map((line, index) => ({
      id: `ev-${page}-${index + 1}`,
      page,
      text: line,
      blockType: "line" as const,
      source,
      confidence: defaultConfidence
    }));
}

export function estimateQuality(evidence: EvidenceBlock[], rawText: string): QualityAssessment {
  const confidences = evidence.map((item) => item.confidence ?? 0).filter((value) => value > 0);
  const averageConfidence = confidences.length
    ? clampConfidence(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
    : 0;
  const notes: string[] = [];
  if (averageConfidence < 60) {
    notes.push("OCR confidence is low and should be reviewed.");
  }
  if (rawText.length < 80) {
    notes.push("The extracted text is sparse for a structured credential document.");
  }

  return {
    averageConfidence,
    documentReadable: hasEnoughSignal(rawText),
    lowSignal: rawText.length < 80 || averageConfidence < 60,
    notes
  };
}
