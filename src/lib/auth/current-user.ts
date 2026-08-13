import { cache } from "react";
import { prisma } from "@/lib/db/client";
import { readSessionFromCookies } from "./session";
import { assertCan, type Permission } from "./rbac";

/**
 * Recuperation de l'utilisateur courant. `cache()` evite de refaire la requete
 * plusieurs fois dans un meme rendu serveur.
 */

export interface CurrentUser {
  id: string;
  role: string;
  status: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  hasProfile: boolean;
  profilePublished: boolean;
  firstName: string | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSessionFromCookies();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      phoneVerified: true,
      emailVerified: true,
      profile: { select: { firstName: true, isPublished: true } },
    },
  });

  if (!user) return null;
  // Revocation globale : la version portee par le jeton doit correspondre.
  if (user.sessionVersion !== session.sv) return null;
  if (user.status === "BANNED" || user.status === "DELETED") return null;

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    hasProfile: user.profile !== null,
    profilePublished: user.profile?.isPublished ?? false,
    firstName: user.profile?.firstName ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user.role, permission);
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentification requise.");
    this.name = "UnauthorizedError";
  }
}

/** Marque l'activite, utilisee par les rails de decouverte et l'anonymisation. */
export async function touchActivity(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }).catch(() => {
    // L'activite est un signal, pas une donnee critique : on n'echoue jamais dessus.
  });
}
