import { z } from "zod";
import { SANCTION_LADDER } from "@/lib/config/enums";
import { requirePermission } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { SANCTION_EFFECT } from "@/lib/moderation/sanctions";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  reportId: z.string().min(1),
  outcome: z.enum([...SANCTION_LADDER, "NO_ACTION"]),
  reason: z.string().min(5).max(1000),
});

const STATUS_FOR: Record<string, string> = {
  WARNING: "ACTIVE",
  RESTRICTION: "RESTRICTED",
  SUSPENSION: "SUSPENDED",
  BAN: "BANNED",
};

export const POST = handler(async (request) => {
  const admin = await requirePermission("reports.action");
  const body = await parseBody(request, schema);

  const report = await prisma.report.findUnique({ where: { id: body.reportId } });
  if (!report) return fail("Signalement introuvable.", 404);

  const adminUser = await prisma.adminUser.findUnique({ where: { userId: admin.id } });

  await prisma.report.update({
    where: { id: body.reportId },
    data: {
      status: body.outcome === "NO_ACTION" ? "DISMISSED" : "ACTIONED",
      outcome: body.outcome,
      handledById: adminUser?.id ?? null,
      handledAt: new Date(),
    },
  });

  if (body.outcome !== "NO_ACTION" && body.outcome !== "WARNING") {
    const newStatus = STATUS_FOR[body.outcome] ?? "ACTIVE";
    await prisma.user.update({
      where: { id: report.reportedId },
      data: {
        status: newStatus,
        statusReason: body.reason,
        // Une suspension ou un bannissement coupe les sessions en cours.
        sessionVersion: { increment: 1 },
      },
    });

    if (!SANCTION_EFFECT[body.outcome].visible) {
      await prisma.profile.updateMany({ where: { userId: report.reportedId }, data: { isPublished: false } });
    }
  }

  if (body.outcome === "WARNING") {
    await prisma.notification.create({
      data: {
        userId: report.reportedId,
        kind: "SAFETY",
        title: "Avertissement",
        body: `Un comportement signalé sur votre compte a été examiné. ${body.reason}`,
        href: "/app/parametres",
      },
    });
  }

  await prisma.adminAction.create({
    data: {
      adminId: adminUser?.id ?? "unknown",
      action: `MODERATION_${body.outcome}`,
      targetType: "User",
      targetId: report.reportedId,
      reason: body.reason,
    },
  }).catch(() => undefined);

  await audit({
    event: `MODERATION_${body.outcome}`,
    actorType: "ADMIN",
    actorRef: pseudonymize(admin.id),
    targetRef: pseudonymize(report.reportedId),
    metadata: { reportId: report.id, category: report.category },
  });

  return ok({ outcome: body.outcome });
});
