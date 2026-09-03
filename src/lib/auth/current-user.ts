import { cache } from "react";
import { prisma } from "@/lib/db/client";
import { readSessionFromCookies } from "./session";

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

/**
 * Frequence maximale d'ecriture de `lastActiveAt`.
 *
 * Sans seuil, chaque page rendue provoquerait une ecriture — un cout inutile
 * pour une donnee dont la precision utile se compte en heures, pas en
 * secondes. Cinq minutes suffisent largement au DAU, aux rails de decouverte
 * et a l'etiquette d'activite (qui, elle, est deja arrondie a la journee).
 */
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000;

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
      lastActiveAt: true,
      profile: { select: { firstName: true, isPublished: true } },
    },
  });

  if (!user) return null;
  // Revocation globale : la version portee par le jeton doit correspondre.
  if (user.sessionVersion !== session.sv) return null;
  if (user.status === "BANNED" || user.status === "DELETED") return null;

  /*
   * §51, §53 — marquage de l'activite.
   *
   * `touchActivity` existait mais n'etait appelee nulle part : `lastActiveAt`
   * restait fige a la date d'inscription. Trois choses en dependent pourtant,
   * et toutes mentaient en silence — le DAU/WAU/MAU du back-office, qui
   * comptait des inscriptions et non des connexions ; l'etiquette « actif
   * aujourd'hui » d'un profil ; et la tache de purge, qui aurait fini par
   * depublier des membres actifs 24 mois apres leur inscription.
   *
   * L'ecriture est volontairement non attendue : l'activite est un signal, pas
   * une donnee critique, et personne ne doit attendre son enregistrement pour
   * voir sa page s'afficher.
   */
  if (Date.now() - user.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    void touchActivity(user.id);
  }

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

/*
 * `requirePermission(permission)` a ete retiree.
 *
 * Elle accordait un droit d'administration sur le seul role porte par la
 * session utilisateur, sans exiger le mot de passe ni le second facteur. Depuis
 * l'introduction de l'elevation (docs/09 §2.1), ce n'est plus le controle
 * voulu — et laisser la fonction en place aurait garanti que quelqu'un la
 * reprenne pour la prochaine route d'administration.
 *
 * Pour une route d'API : `requireAdmin(permission)` (src/lib/admin/service.ts).
 * Pour une page          : `requireAdminPage(permission)` (src/lib/admin/guard.ts).
 */

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
