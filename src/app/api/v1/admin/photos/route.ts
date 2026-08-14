import { z } from "zod";
import { requirePermission } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  photoId: z.string().min(1),
  approve: z.boolean(),
  reason: z.string().max(500).optional(),
});

/** §35 — modération des photos (M4 de docs/00). */
export const POST = handler(async (request) => {
  const admin = await requirePermission("photos.moderate");
  const body = await parseBody(request, schema);

  const photo = await prisma.photo.findUnique({ where: { id: body.photoId } });
  if (!photo) return fail("Photo introuvable.", 404);

  if (!body.approve && (!body.reason || body.reason.trim().length < 5)) {
    return fail("Un refus doit être motivé.", 400);
  }

  await prisma.photo.update({
    where: { id: body.photoId },
    data: {
      moderationStatus: body.approve ? "APPROVED" : "REJECTED",
      moderationReason: body.reason ?? (body.approve ? "Approuvée après revue humaine." : null),
    },
  });

  if (!body.approve) {
    await prisma.notification.create({
      data: {
        userId: photo.userId,
        kind: "SAFETY",
        title: "Photo refusée",
        body: `Une de vos photos n'a pas pu être publiée : ${body.reason}`,
        href: "/app/profil",
      },
    });
  }

  await audit({
    event: body.approve ? "PHOTO_APPROVED" : "PHOTO_REJECTED",
    actorType: "ADMIN",
    actorRef: pseudonymize(admin.id),
    targetRef: pseudonymize(photo.userId),
  });

  return ok({ moderated: true });
});
