import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { buildEvidenceFromText, buildStructuredResult, estimateQuality } from "@credential-lens/pipeline";
import type {
  DocumentResultPayload,
  DocumentStatus,
  DocumentStatusPayload,
  EvidenceBlock,
  StructuredDocumentResult
} from "@credential-lens/types";
import type { Prisma } from "@prisma/client";
import Tesseract from "tesseract.js";
import { config } from "./config.js";
import { maybeAdjudicateWithLlm, maybeAssessWithVlm } from "./llm.js";
import { prisma } from "./prisma.js";
import { decryptJson, encryptJson } from "./security.js";
import { ensureStorage, readStoredFile, toStorageUri } from "./storage.js";

const execFileAsync = promisify(execFile);

import { EventEmitter } from "node:events";
const documentEvents = new EventEmitter();
export { documentEvents };

const stageLabels: Record<DocumentStatus, string> = {
  UPLOADED: "Upload accepted",
  TEXT_EXTRACTION: "Extracting text",
  OCR: "Running OCR",
  STRUCTURING: "Structuring fields",
  VALIDATING: "Validating confidence",
  COMPLETED: "Completed",
  FAILED: "Failed"
};

async function updateStage(
  documentId: string,
  status: DocumentStatus,
  progress: number,
  extra: Prisma.ProcessedDocumentUpdateInput = {},
  systemMessage?: string
) {
  const document = await prisma.processedDocument.update({
    where: { id: documentId },
    data: {
      status,
      progress,
      stageLabel: stageLabels[status],
      ...extra
    }
  });
  
  documentEvents.emit("statusUpdate", {
    id: document.id,
    ownerId: document.ownerId,
    status: document.status,
    progress: document.progress,
    stageLabel: document.stageLabel,
    errorMessage: document.errorMessage,
    systemMessage
  });
}

function buildSummaryLine(result: StructuredDocumentResult): string {
  const institutionField = Object.entries(result.fields).find(([key, f]) => 
    key.toLowerCase().includes("institution") || 
    key.toLowerCase().includes("issuer") || 
    key.toLowerCase().includes("university")
  );
  const institution = institutionField?.[1]?.value ?? "Unclassified document";
  return `${result.summary.documentType} • ${institution}`;
}

function isImageLikeDocument(mimeType: string, rawText: string) {
  return mimeType !== "application/pdf" || rawText.length < 200;
}

function applyUnsupportedResult(reason: string, result: StructuredDocumentResult) {
  const unsupportedFields: Record<string, any> = {};
  for (const [key, field] of Object.entries(result.fields)) {
    unsupportedFields[key] = {
      ...field,
      value: null,
      normalizedValue: null,
      confidence: 0,
      band: "unsupported" as const,
      reasoning: [...field.reasoning, reason]
    };
  }

  return {
    ...result,
    fields: unsupportedFields,
    confidence: Object.fromEntries(Object.keys(result.fields).map((k) => [k, 0])),
    warnings: [reason, ...result.warnings],
    summary: {
      ...result.summary,
      documentType: "unknown" as const,
      reviewBand: "unsupported" as const
    }
  };
}

async function ocrImageBuffer(image: Buffer, page: number) {
  const recognition = await Tesseract.recognize(image, "eng");
  const data = recognition.data as {
    text?: string;
    lines?: Array<{
      text?: string;
      confidence?: number;
      bbox?: { x0: number; y0: number; x1: number; y1: number };
    }>;
  };

  let evidence: EvidenceBlock[] =
    data.lines
      ?.map((line, index) => {
        
        let text = line.text?.replace(/[_—-]{2,}/g, "").replace(/\s+/g, " ").trim();
        
        // Zero-latency heuristic to heal spaced-out kerning (e.g. "N O O B J E C T I O N C E RT I F I C AT E")
        if (text && /^([A-Z]{1,3}\s)+[A-Z]{1,3}$/.test(text)) {
          text = text.replace(/\s+/g, "");
        }

        if (!text) {
          return null;
        }
        const bbox = line.bbox
          ? {
              x: line.bbox.x0,
              y: line.bbox.y0,
              width: Math.max(0, line.bbox.x1 - line.bbox.x0),
              height: Math.max(0, line.bbox.y1 - line.bbox.y0)
            }
          : undefined;
        return {
          id: `ocr-${page}-${index + 1}`,
          page,
          text,
          blockType: "line",
          source: "tesseract",
          confidence: typeof line.confidence === "number" ? Math.round(line.confidence) : null,
          bbox
        } as EvidenceBlock;
      })
      .filter((item): item is EvidenceBlock => item !== null) ?? [];

  const rawText = (data.text ?? "").replace(/\s+\n/g, "\n").trim();
  if (evidence.length === 0 && rawText.length > 0) {
    evidence = buildEvidenceFromText(rawText, "tesseract", page);
  }

  return {
    rawText,
    evidence
  };
}

async function rasterizePdfPages(documentId: string, absolutePath: string): Promise<Buffer[]> {
  const renderDir = resolve(dirname(absolutePath), "..", "renders", documentId);
  await mkdir(renderDir, { recursive: true });
  const outputPrefix = join(renderDir, "page");
  await execFileAsync("pdftoppm", ["-png", absolutePath, outputPrefix]);
  const files = (await readdir(renderDir))
    .filter((name) => name.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return Promise.all(files.map((file) => readFile(join(renderDir, file))));
}

async function extractPdfTextLayer(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true
  });
  const pdfDocument = await loadingTask.promise;
  const pageTexts: string[] = [];
  const allEvidence: EvidenceBlock[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const positionedItems = content.items
      .map((item) => {
        if (!("str" in item)) {
          return null;
        }

        return {
          text: item.str.trim(),
          x: typeof item.transform?.[4] === "number" ? item.transform[4] : 0,
          y: typeof item.transform?.[5] === "number" ? item.transform[5] : 0,
          width: typeof item.width === "number" ? item.width : 0
        };
      })
      .filter((item): item is { text: string; x: number; y: number; width: number } => Boolean(item?.text));

    const sortedItems = [...positionedItems].sort((a, b) => {
      if (Math.abs(a.y - b.y) > 3) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    const lines: Array<{ y: number; parts: { text: string; x: number; width: number }[] }> = [];
    for (const item of sortedItems) {
      const currentLine = lines.at(-1);
      if (!currentLine || Math.abs(currentLine.y - item.y) > 3) {
        lines.push({ y: item.y, parts: [item] });
        continue;
      }
      currentLine.parts.push(item);
    }

    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    const pageEvidence: EvidenceBlock[] = [];

    const pageText = lines
      .map((line, lineIndex) => {
        let lineStr = "";
        let lastX = 0;
        let lastWidth = 0;
        let lineMinX = Infinity;
        let lineMaxX = 0;
        let lineMaxY = 0; // max Y in bottom-up is the highest point (top of text)
        
        for (const part of line.parts) {
          const gap = part.x - (lastX + lastWidth);
          if (lastX > 0 && gap > 20) {
            lineStr += " \t | \t ";
          } else if (lastX > 0) {
            lineStr += " ";
          }
          lineStr += part.text;
          lastX = part.x;
          lastWidth = part.width;

          lineMinX = Math.min(lineMinX, part.x);
          lineMaxX = Math.max(lineMaxX, part.x + part.width);
          lineMaxY = Math.max(lineMaxY, line.y);
        }

        let text = lineStr.replace(/[_—-]{2,}/g, "").replace(/ +/g, " ").trim();
        if (text && /^([A-Z]{1,3}\s)+[A-Z]{1,3}$/.test(text)) {
          text = text.replace(/\s+/g, "");
        }
        
        if (text) {
          // PDF.js transform[5] (y) is usually the baseline in bottom-up coordinates.
          // Convert to top-left coordinates:
          const height = 14; 
          const topY = Math.max(0, pageHeight - lineMaxY - height);
          
          pageEvidence.push({
            id: `pdf-${pageNumber}-${lineIndex}`,
            page: pageNumber,
            text,
            blockType: "line",
            source: "pdf-text",
            confidence: 100,
            bbox: {
              x: lineMinX,
              y: topY,
              width: Math.max(0, lineMaxX - lineMinX),
              height: height
            }
          });
        }
        
        return text;
      })
      .filter(Boolean)
      .join("\n");

    if (pageText) {
      pageTexts.push(pageText);
      allEvidence.push(...pageEvidence);
    }
  }

  return {
    pageTexts,
    evidence: allEvidence,
    text: pageTexts.join("\n").trim(),
    pageCount: pdfDocument.numPages
  };
}

async function extractPdfContent(documentId: string, absolutePath: string, buffer: Buffer) {
  let textLayerError: Error | null = null;
  let rawText = "";
  let evidence: EvidenceBlock[] = [];
  let pageCount = 1;

  let preprocessedBuffer: Buffer | undefined;
  try {
    const renderedPages = await rasterizePdfPages(documentId, absolutePath);
    if (renderedPages.length > 0) {
      preprocessedBuffer = renderedPages[0];
    }
  } catch (err) {
    console.warn("Failed to rasterize PDF for VLM critic", err);
  }

  try {
    const parsed = await extractPdfTextLayer(buffer);
    rawText = parsed.text;
    pageCount = parsed.pageCount;
    evidence = parsed.evidence;
  } catch (error) {
    textLayerError = error instanceof Error ? error : new Error("Unknown PDF parsing error.");
  }

  if (rawText.length >= 80) {
    return { rawText, evidence, pageCount, preprocessedBuffer };
  }

  try {
    const renderedPages = await rasterizePdfPages(documentId, absolutePath);
    const ocrPages = await Promise.all(renderedPages.map((pageBuffer, index) => ocrImageBuffer(pageBuffer, index + 1)));
    rawText = ocrPages.map((page) => page.rawText).filter(Boolean).join("\n");
    evidence = ocrPages.flatMap((page) => page.evidence);
    if (renderedPages.length > 0 && !preprocessedBuffer) {
      preprocessedBuffer = renderedPages[0];
    }
  } catch (ocrError) {
    if (rawText.length > 0) {
      return { rawText, evidence, pageCount, preprocessedBuffer };
    }

    const baseMessage = "Unable to extract text from this PDF.";
    if (textLayerError) {
      throw new Error(
        `${baseMessage} Direct text extraction failed: ${textLayerError.message}. Scanned-PDF fallback also failed; install Poppler (pdftoppm) to enable OCR for raster PDFs.`
      );
    }

    const fallbackMessage =
      ocrError instanceof Error ? ocrError.message : "Scanned-PDF fallback failed.";
    throw new Error(`${baseMessage} ${fallbackMessage}`);
  }

  return { rawText, evidence, pageCount, preprocessedBuffer };
}

async function extractImageContent(buffer: Buffer) {
  let finalBuffer = buffer;
  const tempId = randomUUID();
  const inputPath = join(os.tmpdir(), `input_${tempId}.png`);
  const outputPath = join(os.tmpdir(), `output_${tempId}.png`);
  
  try {
    await writeFile(inputPath, buffer);
    let pythonScript = resolve(__dirname, "scripts", "preprocess-image.py");
    
    if (pythonScript.includes("dist")) {
      pythonScript = pythonScript.replace("dist", "src");
    }
    await execFileAsync("python", [pythonScript, inputPath, outputPath]);
    finalBuffer = await readFile(outputPath);
  } catch (err) {
    console.error("Image preprocessing failed, falling back to original image:", err);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }

  const result = await ocrImageBuffer(finalBuffer, 1);
  return { ...result, pageCount: 1, preprocessedBuffer: finalBuffer };
}

async function processDocument(documentId: string) {
  const document = await prisma.processedDocument.findUnique({ where: { id: documentId } });
  if (!document) {
    return;
  }

  try {
    await ensureStorage();
    await updateStage(documentId, "TEXT_EXTRACTION", 20);

    const fileBuffer = await readStoredFile(document.storedPath);
    let extracted:
      | {
          rawText: string;
          evidence: EvidenceBlock[];
          pageCount: number;
          preprocessedBuffer?: Buffer;
        }
      | undefined;

    if (document.mimeType === "application/pdf") {
      extracted = await extractPdfContent(documentId, resolve(config.STORAGE_ROOT, document.storedPath), fileBuffer);
    } else {
      await updateStage(documentId, "OCR", 50);
      extracted = await extractImageContent(fileBuffer);
    }

    await updateStage(documentId, "STRUCTURING", 72, {
      pageCount: extracted.pageCount
    });

    const quality = estimateQuality(extracted.evidence, extracted.rawText);
    const llmAssessment = await maybeAdjudicateWithLlm(extracted.rawText, extracted.evidence);
    const visionAssessment = await maybeAssessWithVlm({
      mimeType: extracted.preprocessedBuffer ? "image/png" : document.mimeType,
      fileBuffer: extracted.preprocessedBuffer ?? fileBuffer,
      rawText: extracted.rawText,
      evidence: extracted.evidence,
      gcsUri: extracted.preprocessedBuffer ? undefined : toStorageUri(document.storedPath)
    });

    const primaryAssessment = isImageLikeDocument(document.mimeType, extracted.rawText)
      ? visionAssessment ?? llmAssessment
      : llmAssessment ?? visionAssessment;
    const secondaryAssessment = primaryAssessment === visionAssessment ? llmAssessment : visionAssessment;

    const primaryFields = primaryAssessment?.fields ?? [];
    const secondaryFields = secondaryAssessment?.fields ?? [];
    
    const primaryFieldMap = new Map(primaryFields.map((f) => [f.key, f]));
    const secondaryFieldMap = new Map(secondaryFields.map((f) => [f.key, f]));

    const mergedFields = [...primaryFields];
    
    for (const sField of secondaryFields) {
      if (!primaryFieldMap.has(sField.key)) {
        mergedFields.push(sField);
      }
    }

    const conflicts: Record<string, { vision: string | null; llm: string | null }> = {};
    let hasConflicts = false;

    if (visionAssessment?.fields && llmAssessment?.fields) {
      for (const field of mergedFields) {
        const vVal = (visionAssessment === primaryAssessment ? primaryFieldMap : secondaryFieldMap).get(field.key)?.value;
        const lVal = (llmAssessment === primaryAssessment ? primaryFieldMap : secondaryFieldMap).get(field.key)?.value;
        
        if (vVal !== lVal && (vVal || lVal)) {
          conflicts[field.key] = { vision: vVal ?? null, llm: lVal ?? null };
          hasConflicts = true;
        }
      }
    }

    if (hasConflicts) {
      await updateStage(documentId, "STRUCTURING", 75, {}, "Conflict detected. Starting Agentic Auditing...");
      const { resolveConflictsWithLlm } = await import("./llm.js");
      let fullReasoning = "";
      const resolved = await resolveConflictsWithLlm(
        extracted.rawText, 
        conflicts,
        (reasoningChunk) => {
          fullReasoning = reasoningChunk;
          updateStage(documentId, "STRUCTURING", 80, {}, `Auditing conflict: ${reasoningChunk}`).catch(() => {});
        },
        extracted.preprocessedBuffer ?? fileBuffer,
        extracted.preprocessedBuffer ? "image/png" : document.mimeType,
        extracted.preprocessedBuffer ? undefined : toStorageUri(document.storedPath)
      );
      
      for (const [k, v] of Object.entries(resolved)) {
        if (v !== undefined) {
           const field = mergedFields.find(f => f.key === k);
           if (field) {
              field.value = v as string;
           }
        }
      }
    }

    const result = buildStructuredResult({
      rawText: extracted.rawText,
      evidence: extracted.evidence,
      quality,
      llmFields: mergedFields,
      documentTypeOverride:
        primaryAssessment?.documentType && primaryAssessment.documentType !== "unknown"
          ? primaryAssessment.documentType
          : undefined,
      hardUnsupported: primaryAssessment?.supported === false,
      extraWarnings:
        primaryAssessment?.supported === false
          ? [...(primaryAssessment?.warnings ?? []), ...(primaryAssessment?.rationale ?? [])]
          : [...(primaryAssessment?.warnings ?? []), ...(secondaryAssessment?.warnings ?? [])],
      titleHint: primaryAssessment?.titleHint ?? undefined,
      authenticity: primaryAssessment?.authenticity ?? secondaryAssessment?.authenticity ?? undefined
    });
    let finalResult = result;
    if (primaryAssessment?.supported === false) {
      finalResult = applyUnsupportedResult(
        "Model-based review classified this file as unsupported for the credential schema.",
        result
      );
    } else if (quality.lowSignal && result.summary.reviewBand === "unsupported") {
      finalResult = applyUnsupportedResult(
        "Low-signal OCR could not support a trustworthy credential extraction.",
        result
      );
    }

    await updateStage(documentId, "VALIDATING", 90, {
      documentType: finalResult.summary.documentType,
      reviewBand: finalResult.summary.reviewBand,
      qualityJson: JSON.stringify(quality),
      warningsJson: JSON.stringify(finalResult.warnings),
      summaryLine: buildSummaryLine(finalResult),
      encryptedResult: encryptJson(finalResult)
    });

    await updateStage(documentId, "COMPLETED", 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";
    const failed = await prisma.processedDocument.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        progress: 100,
        stageLabel: stageLabels.FAILED,
        errorMessage: message
      }
    });
    documentEvents.emit("statusUpdate", {
      id: failed.id,
      ownerId: failed.ownerId,
      status: failed.status,
      progress: failed.progress,
      stageLabel: failed.stageLabel,
      errorMessage: failed.errorMessage
    });
  }
}

export async function enqueueDocumentProcessing(documentId: string, actorId?: string) {
  void processDocument(documentId);
  if (actorId) {
    await prisma.auditEvent.create({
      data: {
        actorId,
        eventType: "document.processing_enqueued"
      }
    });
  }
}

export async function buildStatusPayload(documentId: string, ownerId: string): Promise<DocumentStatusPayload | null> {
  const document = await prisma.processedDocument.findFirst({
    where: { id: documentId, ownerId }
  });
  if (!document) {
    return null;
  }

  return {
    id: document.id,
    status: document.status as DocumentStatus,
    progress: document.progress,
    stageLabel: document.stageLabel,
    errorMessage: document.errorMessage
  };
}

export async function buildResultPayload(documentId: string, ownerId: string): Promise<DocumentResultPayload | null> {
  const document = await prisma.processedDocument.findFirst({
    where: { id: documentId, ownerId }
  });
  if (!document) {
    return null;
  }

  return {
    id: document.id,
    status: document.status as DocumentStatus,
    progress: document.progress,
    stageLabel: document.stageLabel,
    errorMessage: document.errorMessage,
    fileName: document.fileName,
    mimeType: document.mimeType,
    pageCount: document.pageCount,
    previewUrl: `/api/documents/${document.id}/file`,
    result: document.encryptedResult ? decryptJson<StructuredDocumentResult>(document.encryptedResult) : null
  };
}
