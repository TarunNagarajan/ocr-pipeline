export type DocumentStatus =
  | "UPLOADED"
  | "TEXT_EXTRACTION"
  | "OCR"
  | "STRUCTURING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED";

export type DocumentType =
  | "identity-document"
  | "education-certificate"
  | "marksheet"
  | "professional-certificate"
  | "unknown";

export type ReviewBand = "auto_accept" | "needs_review" | "conflict" | "unsupported";

export type EvidenceSource = "pdf-text" | "tesseract" | "summary";

export type ExtractionSource =
  | "label_match"
  | "regex_match"
  | "keyword_match"
  | "document_summary"
  | "llm_adjudication"
  | "vlm_extraction"
  | "consensus_match"
  | "agentic_self_correction";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceBlock {
  id: string;
  page: number;
  text: string;
  blockType: "line" | "paragraph" | "table-row";
  source: EvidenceSource;
  confidence: number | null;
  bbox?: BoundingBox;
}

export interface QualityAssessment {
  averageConfidence: number;
  documentReadable: boolean;
  lowSignal: boolean;
  notes: string[];
}

export interface ExtractionField {
  value: string | null;
  normalizedValue: string | null;
  confidence: number;
  band: ReviewBand;
  evidenceIds: string[];
  spatialBboxes?: number[][];
  page: number | null;
  sources: ExtractionSource[];
  reasoning: string[];
}

export interface DynamicField extends ExtractionField {
  label: string;
  type: "string" | "date" | "number" | "boolean";
  group: string;
}

export interface AuthenticityAnalysis {
  isAuthentic: boolean;
  score: number;
  reasoning: string[];
}

export interface StructuredDocumentResult {
  fields: Record<string, DynamicField>;
  confidence: Record<string, number>;
  rawText: string;
  warnings: string[];
  summary: {
    documentType: DocumentType;
    titleLines: string[];
    repeatedEntities: string[];
    reviewBand: ReviewBand;
  };
  authenticity?: AuthenticityAnalysis;
  evidence: EvidenceBlock[];
  quality: QualityAssessment;
}

export interface DocumentListItem {
  id: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  documentType: DocumentType;
  reviewBand: ReviewBand;
  summaryLine: string;
}

export interface DocumentStatusPayload {
  id: string;
  status: DocumentStatus;
  progress: number;
  stageLabel: string;
  errorMessage?: string | null;
  systemMessage?: string | null;
}

export interface DocumentResultPayload extends DocumentStatusPayload {
  fileName: string;
  mimeType: string;
  pageCount: number;
  previewUrl: string;
  result: StructuredDocumentResult | null;
}

export interface ProcessDocumentResponse {
  id: string;
  status: DocumentStatus;
  progress: number;
}

export interface AuthUser {
  id: string;
  email: string;
}
