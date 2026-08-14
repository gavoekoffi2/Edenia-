import { prisma } from "@/lib/db/client";
import { authLimits } from "@/lib/config/mode";

/**
 * Limitation de debit (§50).
 *
 * Implementation en base : suffisante pour le pilote (Lome, §4) et surtout sans
 * dependance a un Redis, ce qui simplifie le deploiement initial. L'interface
 * est volontairement etroite pour pouvoir basculer sur un store en memoire
 * partagee quand le volume l'exigera.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const windowEnd = new Date(now.getTime() + windowMs);

  const existing = await prisma.rateLimitCounter.findUnique({ where: { id: key } });

  if (!existing || existing.windowEnd.getTime() <= now.getTime()) {
    await prisma.rateLimitCounter.upsert({
      where: { id: key },
      create: { id: key, count: 1, windowEnd },
      update: { count: 1, windowEnd },
    });
    return { allowed: true, remaining: limit - 1, resetAt: windowEnd };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.windowEnd };
  }

  const updated = await prisma.rateLimitCounter.update({
    where: { id: key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: Math.max(0, limit - updated.count), resetAt: existing.windowEnd };
}

/**
 * Presets utilises par les routes sensibles.
 *
 * Les seuils lies a l'authentification suivent le mode (src/lib/config/mode.ts).
 * Le mecanisme reste identique dans les deux modes : seul le nombre autorise
 * change, pour qu'une session de test qui cree une dizaine de comptes ne se
 * bloque pas elle-meme.
 */
export const LIMITS = {
  otpRequest: { limit: authLimits.otpRequestPerHourPerIp, windowMs: 3_600_000 },
  otpVerify: { limit: authLimits.otpVerifyPerWindow, windowMs: 900_000 },
  login: { limit: authLimits.otpVerifyPerWindow, windowMs: 900_000 },
  message: { limit: 60, windowMs: 60_000 },
  report: { limit: 10, windowMs: 3_600_000 },
  aiTurn: { limit: 40, windowMs: 3_600_000 },
} as const;
