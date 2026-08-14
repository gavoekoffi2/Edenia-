import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { recordAdminAction, requireAdmin } from "@/lib/admin/service";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

/**
 * §35 — modération des photos (M4 de docs/00).
 *
 * Trois décisions possibles, pas deux. « Mettre de côté » (REVIEW_REQUIRED) est
 * une décision légitime : elle permet à un modérateur qui hésite de passer la
 * main plutôt que de trancher au hasard, et la photo reste invisible entre-temps.
 */
const schema = z.object({
  photoId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "REVIEW_REQUIRED"]),
  reason: z.string().max(500).optional(),
});

export const POST = handler(async (request) => {
  const admin = await requireAdmin("photos.moderate");
  const body = await parseBody(request, schema);

  const photo = await prisma.photo.findUnique({ where: { id: body.photoId } });
  if (!photo) return fail("Photo introuvable.", 404);

  const reason = body.reason?.trim() ?? "";
  if (body.decision === "REJECTED" && reason.length < 5) {
    return fail("Un refus doit être motivé.", 400);
  }
  if (body.decision === "REVIEW_REQUIRED" && reason.length < 5) {
    return fail("Indiquez ce qui vous fait hésiter, pour la personne qui reprendra le dossier.", 400);
  }

  await prisma.photo.update({
    where: { id: body.photoId },
    data: {
      moderationStatus: body.decision,
      moderationReason: reason || (body.decision === "APPROVED" ? "Approuvée après revue humaine." : null),
      moderatedAt: new Date(),
      moderatedBy: admin.adminId,
    },
  });

  // On ne notifie que le refus. Une mise en attente n'est pas une décision
  // contre le membre : lui écrire « votre photo pose question » sans pouvoir
  // dire pourquoi ferait plus de mal que de bien.
  if (body.decision === "REJECTED") {
    await prisma.notification
      .create({
        data: {
          userId: photo.userId,
          kind: "SAFETY",
          title: "Photo refusée",
          body: `Une de vos photos n'a pas pu être publiée : ${reason}`,
          href: "/app/profil",
        },
      })
      .catch(() => undefined);
  }

  await recordAdminAction(admin, {
    action: `PHOTO_${body.decision}`,
    targetType: "Photo",
    targetId: photo.id,
    reason: reason || undefined,
  });

  return ok({ decision: body.decision });
});
