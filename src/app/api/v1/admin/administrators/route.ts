import { z } from "zod";
import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import {
  changeAdminRole,
  inviteAdmin,
  requireAdmin,
  resetAdminCredentials,
  setAdminActive,
} from "@/lib/admin/service";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

/**
 * §36 — création et gestion des comptes internes, sans accès à la base.
 *
 * Aucune de ces routes ne renvoie ni ne fabrique de mot de passe. Le seul
 * secret qui sort d'ici est un jeton d'invitation à usage unique, et il ne
 * donne accès qu'à l'écran où l'intéressé choisit lui-même ses identifiants.
 */
const createSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(80),
  roleCode: z.string().min(2).max(40),
});

const patchSchema = z.object({
  adminUserId: z.string().min(1),
  action: z.enum(["enable", "disable", "reset", "role"]),
  roleCode: z.string().min(2).max(40).optional(),
});

function absolute(path: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
}

export const POST = handler(async (request) => {
  const admin = await requireAdmin("admins.manage");
  const body = await parseBody(request, createSchema);

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return fail(
      "Aucun compte membre avec cette adresse. Demandez à la personne de s'inscrire d'abord, puis réessayez.",
      404,
    );
  }

  const result = await inviteAdmin({
    actor: admin,
    userId: user.id,
    displayName: body.displayName,
    roleCode: body.roleCode,
  });

  if (!result.ok) return fail(result.error, 400);

  return ok({
    url: absolute(result.invitation.path),
    expiresAt: result.invitation.expiresAt.toISOString(),
  });
});

export const PATCH = handler(async (request) => {
  const admin = await requireAdmin("admins.manage");
  const body = await parseBody(request, patchSchema);

  switch (body.action) {
    case "enable":
    case "disable": {
      const result = await setAdminActive(admin, body.adminUserId, body.action === "enable");
      if (!result.ok) return fail(result.error ?? "Action impossible.", 400);
      return ok({ isActive: body.action === "enable" });
    }
    case "role": {
      if (!body.roleCode) return fail("Rôle manquant.", 400);
      const result = await changeAdminRole(admin, body.adminUserId, body.roleCode);
      if (!result.ok) return fail(result.error ?? "Action impossible.", 400);
      return ok({ roleCode: body.roleCode });
    }
    case "reset": {
      const result = await resetAdminCredentials(admin, body.adminUserId);
      if (!result.ok) return fail(result.error, 400);
      return ok({
        url: absolute(result.invitation.path),
        expiresAt: result.invitation.expiresAt.toISOString(),
      });
    }
  }
});
