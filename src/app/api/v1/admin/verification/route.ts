import { z } from "zod";
import { VERIFICATION_KIND } from "@/lib/config/enums";
import { requirePermission } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { validateDecision } from "@/lib/verification/levels";
import { TEMPLATES } from "@/lib/notifications";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  requestId: z.string().min(1),
  kind: z.enum(VERIFICATION_KIND),
  approve: z.boolean(),
  checkedCodes: z.array(z.string()).default([]),
  reason: z.string().max(1000).default(""),
});

export const POST = handler(async (request) => {
  const admin = await requirePermission("verification.decide");
  const body = await parseBody(request, schema);

  // §27 : la règle métier est appliquée côté serveur, pas seulement dans l'UI.
  const decision = validateDecision({
    kind: body.kind,
    checkedCodes: body.checkedCodes,
    approve: body.approve,
    reason: body.reason,
  });
  if (!decision.valid) return fail(decision.error ?? "Décision invalide.", 400);

  const record = await prisma.verificationRequest.findUnique({ where: { id: body.requestId } });
  if (!record) return fail("Dossier introuvable.", 404);

  const status = body.approve ? "APPROVED" : "REJECTED";
  const adminUser = await prisma.adminUser.findUnique({ where: { userId: admin.id } });

  await prisma.verificationRequest.update({
    where: { id: body.requestId },
    data: {
      status,
      decidedAt: new Date(),
      agentId: adminUser?.id ?? null,
      notesInternal: body.reason || null,
      messageToUser: body.approve ? null : body.reason,
    },
  });

  await prisma.verificationEvent.create({
    data: {
      requestId: body.requestId,
      actorId: adminUser?.id ?? null,
      action: body.approve ? "APPROVED" : "REJECTED",
      detail: body.reason || null,
    },
  });

  const target = { where: { userId: record.userId } };

  if (body.kind === "IDENTITY") {
    await prisma.identityVerification.update({
      ...target,
      data: {
        status,
        verifiedAt: body.approve ? new Date() : null,
        birthDateChecked: body.checkedCodes.includes("AGE_18"),
        // §26 : les pièces sont détruites après décision, quelle qu'elle soit.
        documentKeyEnc: null,
        selfieKeyEnc: null,
        purgeAfter: new Date(Date.now() + 7 * 86_400_000),
      },
    });
  }

  if (body.kind === "PROFILE") {
    await prisma.profileVerification.update({
      ...target,
      data: {
        status,
        checkedItems: JSON.stringify(decision.checkedItems),
        verifiedAt: body.approve ? new Date() : null,
        agentId: adminUser?.id ?? null,
      },
    });
  }

  if (body.kind === "CHURCH") {
    await prisma.churchVerification.update({
      ...target,
      data: {
        status,
        answer: body.approve ? "CONFIRMED" : "NOT_KNOWN",
        verifiedAt: body.approve ? new Date() : null,
      },
    });
  }

  if (body.approve) {
    await prisma.trustSignal.create({
      data: { userId: record.userId, kind: "POSITIVE_VERIFIED", weight: 15, detail: `Vérification ${body.kind}` },
    });
  }

  const template = body.approve ? TEMPLATES.verificationApproved() : TEMPLATES.verificationRejected(body.reason);
  await prisma.notification.create({
    data: {
      userId: record.userId,
      kind: "VERIFICATION",
      title: template.title,
      body: template.body,
      href: "/app/confiance",
    },
  });

  await prisma.adminAction.create({
    data: {
      adminId: adminUser?.id ?? "unknown",
      action: `VERIFICATION_${status}`,
      targetType: "User",
      targetId: record.userId,
      reason: body.reason || null,
    },
  }).catch(() => undefined);

  await audit({
    event: `VERIFICATION_${status}`,
    actorType: "ADMIN",
    actorRef: pseudonymize(admin.id),
    targetRef: pseudonymize(record.userId),
    metadata: { kind: body.kind },
  });

  return ok({ status });
});
