import { productRules } from "@/lib/config/features";
import { isFreeLaunch } from "@/lib/config/monetization";

/**
 * §31, §43 et C2 — ce que Premium debloque, et surtout ce qu'il ne debloque pas.
 *
 * Regle structurante, verifiee par un test : **aucune capacite de securite ni de
 * verite n'est derriere le paywall**. Premium vend du confort (filtres, tri,
 * volume, visibilite), jamais la protection ni le badge.
 */

export const CAPABILITIES = [
  // --- Toujours gratuit ---------------------------------------------------
  "profile.create",
  "profile.edit",
  "discovery.basic",
  "match.like",
  "match.chat",
  "badge.see", // §30 : le badge est visible par tout le monde
  "verification.request", // §31 : demander sa verification est gratuit
  "safety.report",
  "safety.block",
  "safety.warnings",
  "compatibility.score", // le score de base reste visible
  "ai.onboarding",

  // --- Premium ------------------------------------------------------------
  "discovery.filter_verified_only",
  "discovery.advanced_filters",
  "discovery.unlimited_rails",
  "compatibility.full_breakdown", // les 7 dimensions detaillees
  "discovery.see_who_liked",
  "ai.bio_improve",
  "ai.reply_help",
  "discovery.diaspora_full",
  "profile.boost_visibility",
  "likes.extended_quota",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Capacites qui ne doivent JAMAIS devenir payantes (§31, §60). */
export const NEVER_PAYWALLED: readonly Capability[] = [
  "profile.create",
  "profile.edit",
  "discovery.basic",
  "match.like",
  "match.chat",
  "badge.see",
  "verification.request",
  "safety.report",
  "safety.block",
  "safety.warnings",
  "compatibility.score",
  "ai.onboarding",
];

const PREMIUM_ONLY: readonly Capability[] = [
  "discovery.filter_verified_only",
  "discovery.advanced_filters",
  "discovery.unlimited_rails",
  "compatibility.full_breakdown",
  "discovery.see_who_liked",
  "ai.bio_improve",
  "ai.reply_help",
  "discovery.diaspora_full",
  "profile.boost_visibility",
  "likes.extended_quota",
];

export type Tier = "FREE" | "PREMIUM";

/**
 * Le parametre `freeLaunch` a une valeur par defaut, jamais passee en
 * production : il existe pour que les tests puissent verifier les **deux**
 * regimes. Sans lui, la grille Premium deviendrait invisible aux tests des
 * qu'on passe en lancement gratuit, et personne ne s'apercevrait qu'elle a
 * ete cassee le jour ou on la rallume.
 */
export function hasCapability(
  tier: Tier,
  capability: Capability,
  freeLaunch: boolean = isFreeLaunch,
): boolean {
  if (NEVER_PAYWALLED.includes(capability)) return true;
  // §1 du sprint final : en lancement gratuit, il n'existe pas de capacite
  // reservee — pas parce qu'on l'a retiree du code, mais parce qu'il n'y a
  // personne a qui la refuser. Ce point unique evite qu'un ecran oublie
  // la regle et affiche un cadenas fantome.
  if (freeLaunch) return true;
  if (PREMIUM_ONLY.includes(capability)) return tier === "PREMIUM";
  return true;
}

export function dailyLikeLimit(tier: Tier, freeLaunch: boolean = isFreeLaunch): number {
  if (freeLaunch) return productRules.dailyLikeLimitPremium;
  return tier === "PREMIUM" ? productRules.dailyLikeLimitPremium : productRules.dailyLikeLimitFree;
}

/** §23 : le rail « Profils vérifiés » reste consultable en gratuit, en volume limite. */
export function railLimit(tier: Tier, rail: string, freeLaunch: boolean = isFreeLaunch): number {
  if (freeLaunch || tier === "PREMIUM") return 30;
  return rail === "verified" ? 3 : 10;
}

export interface PlanOffer {
  code: string;
  nameFr: string;
  /** En centimes de la devise (XOF n'a pas de subdivision : 1 unite = 1 FCFA). */
  priceCents: number;
  currency: string;
  durationDays: number;
  perMonthLabel: string;
  highlight?: string;
}

/**
 * §43 — « Les tarifs doivent etre penses pour le pouvoir d'achat des marches
 * africains, et non simplement convertir un prix occidental en FCFA. »
 *
 * Ancrage retenu : le prix d'un forfait data mensuel courant au Togo, soit
 * environ 2 000 FCFA. Un abonnement de rencontre ne doit pas couter plus cher
 * que la connexion qui permet de l'utiliser.
 */
export const PLAN_OFFERS: readonly PlanOffer[] = [
  {
    code: "PREMIUM_1M",
    nameFr: "Premium — 1 mois",
    priceCents: 2000,
    currency: "XOF",
    durationDays: 30,
    perMonthLabel: "2 000 FCFA / mois",
  },
  {
    code: "PREMIUM_3M",
    nameFr: "Premium — 3 mois",
    priceCents: 5000,
    currency: "XOF",
    durationDays: 90,
    perMonthLabel: "≈ 1 667 FCFA / mois",
    highlight: "Le plus choisi",
  },
  {
    code: "PREMIUM_12M",
    nameFr: "Premium — 12 mois",
    priceCents: 15000,
    currency: "XOF",
    durationDays: 365,
    perMonthLabel: "1 250 FCFA / mois",
  },
];

export function formatXof(cents: number): string {
  return `${cents.toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;
}
