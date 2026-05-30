import type { Request } from "express";
import { prisma } from "./prisma.js";

const demoEmail = "demo@credential-lens.local";
const demoPasswordHash = "demo-session-placeholder";

export async function resolveActor(req: Request) {
  if (req.user) {
    return req.user;
  }

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash: demoPasswordHash
    },
    select: {
      id: true,
      email: true
    }
  });

  return user;
}
