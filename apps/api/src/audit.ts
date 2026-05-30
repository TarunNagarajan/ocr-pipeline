import type { Request } from "express";
import { prisma } from "./prisma.js";
import { hashAuditValue } from "./security.js";

export async function audit(req: Request, eventType: string, actorId?: string, metadata?: Record<string, unknown>) {
  await prisma.auditEvent.create({
    data: {
      actorId,
      eventType,
      ipHash: hashAuditValue(req.ip),
      userAgentHash: hashAuditValue(req.get("user-agent")),
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });
}
