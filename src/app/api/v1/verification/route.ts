import { z } from "zod";
import { VERIFICATION_KIND } from "@/lib/config/enums";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  kind: z.enum(VERIFICATION_KIND),
  churchId: z.string().optional(),
  // §28 + C6 : la vérification église exige un consentement explicite et distinct.
  consent: z.boolean().default(false),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  const pending = await prisma.verificationRequest.findFirst({
    where: { userId: user.id, kind: body.kind, status: { in: ["PENDING", "IN_REVIEW", "NEED_MORE_INFO"] } },
  });
  if (pending) return fail("Une demande est déjà en cours pour ce niveau.", 409);

  if (body.kind === "CHURCH") {
    if (!body.churchId) return fail("Indiquez votre église.", 400);
    if (!body.consent) {
      return fail(
        "Nous ne contacterons votre église qu'avec votre accord explicite. Cochez la case pour continuer.",
        400,
      );
    }
    await prisma.consent.create({
      data: { userId: user.id, purpose: "CHURCH_VERIFICATION", granted: true, version: "2026-01" },
    });
    await prisma.churchVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, churchId: body.churchId, status: "PENDING", consentAt: new Date() },
      update: { churchId: body.churchId, status: "PENDING", consentAt: new Date(), consentRevokedAt: null },
    });
  }

  if (body.kind === "IDENTITY") {
    await prisma.identityVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: "PENDING" },
      update: { status: "PENDING" },
    });
  }

  if (body.kind === "PROFILE") {
    await prisma.profileVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: "PENDING" },
      update: { status: "PENDING" },
    });
  }

  const created = await prisma.verificationRequest.create({
    data: { userId: user.id, kind: body.kind, status: "PENDING" },
  });

  await prisma.verificationEvent.create({
    data: { requestId: created.id, action: "SUBMITTED", detail: `Demande ${body.kind}` },
  });

  await audit({
    event: "VERIFICATION_REQUESTED",
    actorType: "USER",
    actorRef: pseudonymize(user.id),
    metadata: { kind: body.kind },
  });

  return ok({
    requestId: created.id,
    // §31 : on le redit à chaque demande, parce que c'est le cœur de la promesse.
    message: "Votre demande est enregistrée. La vérification est gratuite et ne peut pas être accélérée par un paiement.",
  });
});
