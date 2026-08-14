import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { isDevAuth } from "@/lib/config/mode";
import { MAX_PHOTOS_PER_USER, autoModerate, processAndStore } from "@/lib/storage/photos";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { fail, handler, ok } from "@/lib/api/respond";

/** Téléversement d'une photo de profil (multipart). */
export const POST = handler(async (request) => {
  const user = await requireUser();

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Requête invalide.", 400);

  const file = form.get("photo");
  if (!(file instanceof File)) return fail("Aucune photo reçue.", 400);

  const existing = await prisma.photo.count({ where: { userId: user.id } });
  if (existing >= MAX_PHOTOS_PER_USER) {
    return fail(`Vous avez atteint la limite de ${MAX_PHOTOS_PER_USER} photos.`, 409);
  }

  const processed = await processAndStore(file, user.id);
  if (!processed.ok) return fail(processed.error, 400);

  const verdict = autoModerate(processed.photo, { devMode: isDevAuth });
  if (verdict.status === "REJECTED") return fail(verdict.reason, 400);

  const photo = await prisma.photo.create({
    data: {
      userId: user.id,
      storageKey: processed.photo.storageKey,
      width: processed.photo.width,
      height: processed.photo.height,
      blurhash: processed.photo.blurhash,
      position: existing,
      isPrimary: existing === 0,
      moderationStatus: verdict.status,
      moderationReason: verdict.reason,
    },
  });

  await audit({
    event: "PHOTO_UPLOADED",
    actorType: "USER",
    actorRef: pseudonymize(user.id),
    metadata: { moderationStatus: verdict.status, bytes: processed.photo.bytes },
  });

  return ok({
    id: photo.id,
    url: `/media/${photo.storageKey}`,
    blurhash: photo.blurhash,
    isPrimary: photo.isPrimary,
    moderationStatus: photo.moderationStatus,
    // §9 : on dit clairement à l'utilisateur où en est sa photo.
    message:
      verdict.status === "APPROVED"
        ? "Photo ajoutée."
        : "Photo reçue. Elle apparaîtra sur votre profil après vérification par notre équipe.",
  });
});

/** Liste des photos de la personne connectée, y compris celles en attente. */
export const GET = handler(async () => {
  const user = await requireUser();
  const photos = await prisma.photo.findMany({
    where: { userId: user.id },
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
  });

  return ok({
    photos: photos.map((photo) => ({
      id: photo.id,
      url: `/media/${photo.storageKey}`,
      blurhash: photo.blurhash,
      isPrimary: photo.isPrimary,
      moderationStatus: photo.moderationStatus,
      moderationReason: photo.moderationReason,
    })),
    max: MAX_PHOTOS_PER_USER,
  });
});
