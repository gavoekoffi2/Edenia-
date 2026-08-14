import { z } from "zod";
import { VERIFICATION_KIND } from "@/lib/config/enums";
import { recordAdminAction, requireAdmin } from "@/lib/admin/service";
import { prisma } from "@/lib/db/client";
import { validateDecision, verificationExpiryFrom } from "@/lib/verification/levels";
import { TEMPLATES } from "@/lib/notifications";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  requestId: z.string().min(1),
  kind: z.enum(VERIFICATION_KIND),
  approve: z.boolean(),
  checkedCodes: z.array(z.string()).default([]),
  reason: z.string().max(1000).default(""),
});

export const POST = handler(async (request) => {
  const admin = await requireAdmin("verification.decide");
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

  await prisma.verificationRequest.update({
    where: { id: body.requestId },
    data: {
      status,
      decidedAt: new Date(),
      agentId: admin.adminId,
      notesInternal: body.reason || null,
      messageToUser: body.approve ? null : body.reason,
    },
  });

  await prisma.verificationEvent.create({
    data: {
      requestId: body.requestId,
      actorId: admin.adminId,
      action: body.approve ? "APPROVED" : "REJECTED",
      detail: body.reason || null,
    },
  });

  const target = { where: { userId: record.userId } };

  const decidedAt = new Date();

  if (body.kind === "IDENTITY") {
    await prisma.identityVerification.update({
      ...target,
      data: {
        status,
        verifiedAt: body.approve ? decidedAt : null,
        // §29 : le champ existait sans que personne ne l'ecrive. Une date
        // d'expiration jamais renseignee est une date d'expiration absente.
        expiresAt: body.approve ? verificationExpiryFrom(decidedAt) : null,
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
        agentId: admin.adminId,
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

  await recordAdminAction(admin, {
    action: `VERIFICATION_${status}`,
    targetType: "User",
    targetId: record.userId,
    reason: body.reason || undefined,
    metadata: { kind: body.kind },
  });

  return ok({ status });
});
