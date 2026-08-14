import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";

/**
 * §9, §36 — liens de configuration a usage unique.
 *
 * Volontairement isole de `service.ts` : ce module ne depend ni de React ni de
 * `next/headers`, ce qui permet a la commande de creation du premier
 * administrateur de l'utiliser hors du serveur Next.
 *
 * Le jeton en clair n'existe qu'une fois, dans la valeur de retour. La base ne
 * garde que son empreinte : meme un acces en lecture a la base ne permet pas de
 * reconstituer un lien valide.
 */

export const INVITATION_TTL_MS = 72 * 3_600_000;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedInvitation {
  /** Chemin a transmettre a l'interesse. Non recuperable ensuite. */
  path: string;
  expiresAt: Date;
}

/** Emet un lien de configuration et invalide tous les precedents. */
export async function issueInvitation(
  adminUserId: string,
  createdById: string | null,
): Promise<CreatedInvitation> {
  await prisma.adminInvitation.deleteMany({ where: { adminUserId, consumedAt: null } });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  await prisma.adminInvitation.create({
    data: { adminUserId, tokenHash: hashInvitationToken(token), expiresAt, createdById },
  });

  return { path: `/admin/configuration/${token}`, expiresAt };
}
