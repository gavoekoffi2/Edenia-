import { z } from "zod";
import { completeAuth } from "@/lib/auth/service";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { hashIp } from "@/lib/crypto/field";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { clientIp, fail, handler, ok, parseBody } from "@/lib/api/respond";
import { prisma } from "@/lib/db/client";

const schema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{4,8}$/, "Le code ne contient que des chiffres."),
});

export const POST = handler(async (request) => {
  const body = await parseBody(request, schema);
  const ip = clientIp(request);

  const limit = await rateLimit(`otp:ver:${hashIp(ip) ?? "anon"}`, LIMITS.otpVerify.limit, LIMITS.otpVerify.windowMs);
  if (!limit.allowed) return fail("Trop de tentatives. Réessayez dans quelques minutes.", 429);

  const result = await completeAuth(body.challengeId, body.code, ip);
  if (!result.ok || !result.token) {
    return fail(result.error ?? "Vérification impossible.", 400, { attemptsLeft: result.attemptsLeft });
  }

  // L'utilisateur va-t-il vers l'onboarding ou vers la découverte ?
  const profile = await prisma.profile.findUnique({
    where: { userId: result.userId! },
    select: { isPublished: true },
  });

  const response = ok({
    userId: result.userId,
    isNewUser: result.isNewUser,
    next: profile?.isPublished ? "/app/decouvrir" : "/app/onboarding",
  });
  response.cookies.set(SESSION_COOKIE, result.token, SESSION_COOKIE_OPTIONS);
  return response;
});
