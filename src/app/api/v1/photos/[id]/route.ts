import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { deletePhoto } from "@/lib/storage/photos";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler<Ctx>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const photo = await prisma.photo.findUnique({ where: { id } });
  // Message identique qu'elle n'existe pas ou qu'elle appartienne à autrui :
  // pas d'énumération d'identifiants.
  if (!photo || photo.userId !== user.id) return fail("Photo introuvable.", 404);

  await prisma.photo.delete({ where: { id } });
  await deletePhoto(photo.storageKey);

  // Si la photo principale disparaît, la suivante prend sa place.
  if (photo.isPrimary) {
    const next = await prisma.photo.findFirst({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });
    if (next) await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  return ok({ deleted: true });
});

const patchSchema = z.object({ isPrimary: z.literal(true) });

export const PATCH = handler<Ctx>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await parseBody(request, patchSchema);

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo || photo.userId !== user.id) return fail("Photo introuvable.", 404);
  if (photo.moderationStatus !== "APPROVED") {
    return fail("Cette photo doit d'abord être approuvée.", 409);
  }

  await prisma.$transaction([
    prisma.photo.updateMany({ where: { userId: user.id }, data: { isPrimary: false } }),
    prisma.photo.update({ where: { id }, data: { isPrimary: true } }),
  ]);

  return ok({ isPrimary: true });
});
