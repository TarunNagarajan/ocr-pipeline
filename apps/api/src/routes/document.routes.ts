import type { DocumentListItem, ProcessDocumentResponse } from "@credential-lens/types";
import type { Prisma } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import multer from "multer";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { resolveActor } from "../actor.js";
import { audit } from "../audit.js";
import { config } from "../config.js";
import { buildResultPayload, buildStatusPayload, documentEvents, enqueueDocumentProcessing } from "../documents.js";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { readStoredFile } from "../storage.js";
import { documentIdSchema } from "../validators.js";
import { persistUpload } from "../storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024
  }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export const documentRouter = Router();

documentRouter.get("/documents/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const handleUpdate = (data: any) => {
    if (data.ownerId === req.user?.id || !req.user) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  documentEvents.on("statusUpdate", handleUpdate);

  req.on("close", () => {
    documentEvents.off("statusUpdate", handleUpdate);
  });
});

documentRouter.post("/documents/process", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    const actor = await resolveActor(req);
    if (!req.file) {
      throw new HttpError(400, "A PDF, PNG, or JPEG file is required.", "missing_file");
    }

    const detected = await fileTypeFromBuffer(req.file.buffer);
    const effectiveMime = detected?.mime ?? req.file.mimetype;
    if (!allowedMimeTypes.has(effectiveMime)) {
      throw new HttpError(400, "Only PDF, PNG, and JPEG uploads are supported.", "unsupported_file_type");
    }

    const document = await prisma.processedDocument.create({
      data: {
        ownerId: actor.id,
        fileName: req.file.originalname,
        mimeType: effectiveMime,
        sizeBytes: req.file.size,
        sha256: "",
        storedPath: ""
      }
    });

    const saved = await persistUpload(document.id, req.file.originalname, req.file.buffer);
    await prisma.processedDocument.update({
      where: { id: document.id },
      data: {
        sha256: saved.sha256,
        storedPath: saved.relativePath,
        previewPath: saved.relativePath
      }
    });

    await audit(req, "document.uploaded", actor.id, {
      documentId: document.id,
      fileName: req.file.originalname,
      mimeType: effectiveMime
    });
    await enqueueDocumentProcessing(document.id, actor.id);

    const payload: ProcessDocumentResponse = {
      id: document.id,
      status: "UPLOADED",
      progress: 5
    };
    res.status(202).json(payload);
  } catch (error) {
    next(error);
  }
});

documentRouter.get("/documents", async (req, res, next) => {
  try {
    const actor = await resolveActor(req);
    const documents = await prisma.processedDocument.findMany({
      where: { ownerId: actor.id },
      orderBy: { createdAt: "desc" }
    });

    const payload: DocumentListItem[] = documents.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      status: document.status as DocumentListItem["status"],
      progress: document.progress,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      documentType: document.documentType as DocumentListItem["documentType"],
      reviewBand: document.reviewBand as DocumentListItem["reviewBand"],
      summaryLine: document.summaryLine
    }));

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

documentRouter.get("/documents/:id/status", async (req, res, next) => {
  try {
    const actor = await resolveActor(req);
    const { id } = documentIdSchema.parse(req.params);
    const payload = await buildStatusPayload(id, actor.id);
    if (!payload) {
      throw new HttpError(404, "Document not found.", "document_not_found");
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

documentRouter.get("/documents/:id/result", async (req, res, next) => {
  try {
    const actor = await resolveActor(req);
    const { id } = documentIdSchema.parse(req.params);
    const payload = await buildResultPayload(id, actor.id);
    if (!payload) {
      throw new HttpError(404, "Document not found.", "document_not_found");
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

documentRouter.get("/documents/:id/file", async (req, res, next) => {
  try {
    const actor = await resolveActor(req);
    const { id } = documentIdSchema.parse(req.params);
    const document = await prisma.processedDocument.findFirst({
      where: { id, ownerId: actor.id }
    });
    if (!document) {
      throw new HttpError(404, "Document not found.", "document_not_found");
    }

    const buffer = await readStoredFile(document.storedPath);
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${config.WEB_ORIGIN}`);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${document.fileName.replace(/"/g, "")}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
