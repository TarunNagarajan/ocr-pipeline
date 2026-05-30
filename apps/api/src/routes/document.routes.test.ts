import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { EventEmitter } from "node:events";
import { documentRouter } from "./document.routes.js";

vi.mock("../actor.js", () => ({
  resolveActor: vi.fn().mockResolvedValue({ id: "test-user-123", email: "demo@credential-lens.local" })
}));

vi.mock("../documents.js", () => ({
  buildStatusPayload: vi.fn().mockResolvedValue(null),
  buildResultPayload: vi.fn().mockResolvedValue(null),
  documentEvents: new EventEmitter(),
  enqueueDocumentProcessing: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../storage.js", () => ({
  persistUpload: vi.fn().mockResolvedValue({ relativePath: "fake/path", sha256: "fake-hash" })
}));

vi.mock("../prisma.js", () => ({
  prisma: {
    processedDocument: {
      create: vi.fn().mockResolvedValue({ id: "doc-123" }),
      update: vi.fn().mockResolvedValue({ id: "doc-123" }),
      findMany: vi.fn().mockResolvedValue([])
    }
  }
}));

vi.mock("../audit.js", () => ({
  audit: vi.fn().mockResolvedValue(undefined)
}));

const app = express();
app.use(express.json());
app.use(documentRouter);


app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.status || 500).json({ error: err.message, code: err.code });
});

describe("document routes", () => {
  it("rejects file uploads that are not PDF, PNG, or JPEG", async () => {
    const response = await request(app)
      .post("/documents/process")
      .attach("file", Buffer.from("dummy content"), "test.txt");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("unsupported_file_type");
  });

  it("returns 404 for status retrieval on missing doc", async () => {
    const response = await request(app).get("/documents/non-existent-id/status");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("document_not_found");
  });

  it("returns 404 for result retrieval on missing doc", async () => {
    const response = await request(app).get("/documents/non-existent-id/result");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("document_not_found");
  });
});
