import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { recordAdminAction, requireAdmin } from "@/lib/admin/service";
import { assertCan } from "@/lib/auth/rbac";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

/**
 * §35 — changement de statut d'un compte, depuis la liste des utilisateurs.
 *
 * Le motif est obligatoire : une sanction sans motif écrit est une sanction
 * qu'on ne peut ni expliquer au membre, ni défendre six mois plus tard.
 */
const schema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  reason: z.string().trim().min(5).max(500),
});

export const PATCH = handler(async (request) => {
  /*
   * L'authentification passe AVANT la lecture du corps.
   *
   * L'ordre inverse — parser puis authentifier, parce que la permission exacte
   * dépend du statut demandé — renvoyait un 400 de validation à un appelant
   * anonyme : il apprenait la forme attendue et les valeurs acceptées sans
   * jamais s'être identifié. On établit donc l'identité sur la permission la
   * plus faible des deux, puis on exige la seconde une fois le corps connu.
   */
  const admin = await requireAdmin("users.suspend");
  const body = await parseBody(request, schema);

  // Suspendre et bannir sont deux permissions distinctes : un modérateur peut
  // suspendre, il ne peut pas bannir.
  if (body.status === "BANNED") assertCan(admin.role, "users.ban");

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, status: true, role: true },
  });
  if (!target) return fail("Compte introuvable.", 404);
  if (target.id === admin.userId) return fail("Vous ne pouvez pas modifier votre propre compte.", 400);
  if (target.role !== "USER") {
    return fail("Ce compte porte un rôle interne : passez par la page Administrateurs.", 400);
  }

  await prisma.user.update({
    where: { id: body.userId },
    data: {
      status: body.status,
      statusReason: body.reason,
      // Une suspension ou un bannissement coupe les sessions en cours.
      ...(body.status === "ACTIVE" ? {} : { sessionVersion: { increment: 1 } }),
    },
  });

  if (body.status !== "ACTIVE") {
    await prisma.profile.updateMany({ where: { userId: body.userId }, data: { isPublished: false } });
  }

  await recordAdminAction(admin, {
    action: `USER_${body.status}`,
    targetType: "User",
    targetId: body.userId,
    reason: body.reason,
    metadata: { from: target.status, to: body.status },
  });

  return ok({ status: body.status });
});
