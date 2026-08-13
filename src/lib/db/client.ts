import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma unique. En developpement, Next recharge les modules a chaud :
 * sans ce cache global, chaque rechargement ouvrirait une nouvelle connexion.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
