import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { handler, ok } from "@/lib/api/respond";

/**
 * §47 — suppression de compte.
 *
 * Effet immédiat : le profil disparaît et toutes les sessions sont révoquées.
 * L'effacement complet suit sous 30 jours (voir docs/09). On ne détruit pas
 * tout dans la seconde : une suppression accidentelle doit pouvoir être
 * rattrapée, et certains journaux d'audit pseudonymisés doivent survivre.
 */
export const DELETE = handler(async () => {
  const user = await requireUser();

  await prisma.$transaction([
    prisma.profile.updateMany({ where: { userId: user.id }, data: { isPublished: false } }),
    prisma.match.updateMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      data: { status: "ENDED" },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        deletionRequestedAt: new Date(),
        // Révocation immédiate de toutes les sessions.
        sessionVersion: { increment: 1 },
      },
    }),
  ]);

  await audit({ event: "ACCOUNT_DELETION_REQUESTED", actorType: "USER", actorRef: pseudonymize(user.id) });

  const response = ok({
    deleted: true,
    message: "Votre compte est fermé. Vos données personnelles seront effacées sous 30 jours.",
  });
  response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
});
