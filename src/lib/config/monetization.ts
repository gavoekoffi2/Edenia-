import { env } from "./env";

/**
 * §1 à §5 du sprint final — EDENIA est gratuite au lancement.
 *
 * Ce module est la seule source de verite sur la question « est-ce que Premium
 * existe pour l'utilisateur ? ». Le code Premium n'est pas supprime : il est
 * eteint. Un seul reglage le rallume, sans migration ni redeploiement du
 * schema.
 *
 * Regle non negociable (§5) : un don n'achete rien. Ni badge, ni visibilite,
 * ni meilleur matching, ni quota superieur. Elle est encodee ici en constantes
 * pour que les tests puissent la verifier plutot que de la relire.
 */

export type MonetizationMode = "free" | "donations" | "premium";

export const monetizationMode: MonetizationMode = env.MONETIZATION_MODE;

/** True quand aucun paiement n'est requis pour utiliser le service. */
export const isFreeLaunch = monetizationMode !== "premium";

/** True quand les surfaces Premium sont visibles par les utilisateurs. */
export const premiumIsPublic = monetizationMode === "premium";

/** True quand le bouton « Soutenir EDENIA » est propose. */
export const donationsEnabled = env.DONATIONS_ENABLED;

/**
 * §5 — ce qu'un don ne donne jamais. La liste est exhaustive et testee :
 * ajouter un avantage ici ferait echouer la suite de tests, ce qui est
 * exactement l'effet recherche.
 */
export const DONATION_GRANTS_NOTHING = [
  "badge",
  "verification",
  "visibility",
  "matching-boost",
  "priority-support",
  "extra-likes",
  "premium-features",
  "profile-ranking",
] as const;

/**
 * Quotas effectifs. En lancement gratuit, tout le monde recoit le quota le
 * plus genereux : il n'existe pas de version bridee puisqu'il n'existe pas de
 * version payante.
 */
export function effectiveLikeLimit(hasPremium: boolean, limits: { free: number; premium: number }): number {
  if (isFreeLaunch) return limits.premium;
  return hasPremium ? limits.premium : limits.free;
}

/**
 * Une fonctionnalite est-elle accessible a cet utilisateur ?
 * En lancement gratuit la reponse est toujours oui — c'est la definition du
 * mode, et la centraliser evite qu'un ecran oublie la regle.
 */
export function canUsePremiumFeature(hasPremium: boolean): boolean {
  return isFreeLaunch || hasPremium;
}

/** Etiquette affichee dans le back-office (§22). */
export function monetizationLabel(): string {
  switch (monetizationMode) {
    case "premium":
      return "Abonnements Premium actifs";
    case "donations":
      return "Gratuit — soutien par dons";
    default:
      return "Gratuit — soutien par dons";
  }
}
