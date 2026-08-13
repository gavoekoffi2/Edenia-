import { z } from "zod";
import { REPORT_CATEGORY } from "@/lib/config/enums";
import { requireUser } from "@/lib/auth/current-user";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { prisma } from "@/lib/db/client";
import { reportPriority } from "@/lib/moderation/sanctions";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  targetId: z.string().min(1),
  category: z.enum(REPORT_CATEGORY),
  detail: z.string().max(2000).optional(),
  messageId: z.string().optional(),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  const limit = await rateLimit(`report:${user.id}`, LIMITS.report.limit, LIMITS.report.windowMs);
  if (!limit.allowed) return fail("Trop de signalements en peu de temps. Réessayez plus tard.", 429);

  const severity = reportPriority(body.category);

  await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedId: body.targetId,
      category: body.category,
      detail: body.detail ?? null,
      messageId: body.messageId ?? null,
      severity,
    },
  });

  // §34 : un signalement est un signal interne, jamais un score public.
  await prisma.trustSignal.create({
    data: {
      userId: body.targetId,
      kind: "REPORTED",
      weight: severity === "CRITICAL" ? -25 : severity === "HIGH" ? -15 : -8,
      detail: `Signalement : ${body.category}`,
    },
  });

  await audit({
    event: "REPORT_CREATED",
    actorType: "USER",
    actorRef: pseudonymize(user.id),
    targetRef: pseudonymize(body.targetId),
    metadata: { category: body.category, severity },
  });

  return ok({
    reported: true,
    message:
      "Merci. Une personne de notre équipe examinera ce signalement. Vous pouvez aussi bloquer ce profil dès maintenant.",
  });
});
