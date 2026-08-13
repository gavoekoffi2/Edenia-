import type { ReportCategory, Sanction } from "@/lib/config/enums";

/**
 * §35 — Moderation. « Avertissement → Restriction → Suspension → Bannissement ».
 *
 * L'echelle est progressive **par principe**, avec deux exceptions assumees :
 * la minorite presumee et la demande d'argent caracterisee. Attendre un
 * deuxieme incident dans ces cas-la reviendrait a laisser un prejudice se
 * produire.
 */

export const SANCTION_ORDER: Sanction[] = ["WARNING", "RESTRICTION", "SUSPENSION", "BAN"];

export const SANCTION_LABEL: Record<Sanction, string> = {
  WARNING: "Avertissement",
  RESTRICTION: "Restriction",
  SUSPENSION: "Suspension",
  BAN: "Bannissement",
};

export const SANCTION_EFFECT: Record<Sanction, { canLike: boolean; canMessage: boolean; visible: boolean; durationDays: number | null }> = {
  WARNING: { canLike: true, canMessage: true, visible: true, durationDays: null },
  RESTRICTION: { canLike: false, canMessage: true, visible: false, durationDays: 7 },
  SUSPENSION: { canLike: false, canMessage: false, visible: false, durationDays: 30 },
  BAN: { canLike: false, canMessage: false, visible: false, durationDays: null },
};

/** Categories qui declenchent la sanction maximale des le premier signalement fonde. */
const ZERO_TOLERANCE: ReportCategory[] = ["UNDERAGE", "SCAM_MONEY"];

export interface SanctionInput {
  category: ReportCategory;
  /** Sanctions deja prononcees contre ce compte, de la plus ancienne a la plus recente. */
  history: Sanction[];
  /** Le signalement a-t-il ete confirme par un moderateur ? */
  confirmed: boolean;
  /** Nombre de signalements distincts et confirmes sur les 30 derniers jours. */
  recentConfirmedReports: number;
}

export interface SanctionRecommendation {
  sanction: Sanction;
  rationale: string;
  /** True si un humain doit imperativement trancher avant application. */
  requiresHumanReview: boolean;
  immediate: boolean;
}

export function recommendSanction(input: SanctionInput): SanctionRecommendation {
  if (!input.confirmed) {
    return {
      sanction: "WARNING",
      rationale: "Signalement non confirmé : aucune mesure automatique.",
      requiresHumanReview: true,
      immediate: false,
    };
  }

  if (input.category === "UNDERAGE") {
    return {
      sanction: "SUSPENSION",
      rationale:
        "Soupçon de minorité : suspension immédiate le temps de la vérification d'âge. La progressivité ne s'applique pas ici.",
      requiresHumanReview: true,
      immediate: true,
    };
  }

  if (input.category === "SCAM_MONEY") {
    return {
      sanction: input.history.length > 0 ? "BAN" : "SUSPENSION",
      rationale:
        "Demande d'argent caractérisée : le préjudice est financier et irréversible, la sanction est immédiate.",
      requiresHumanReview: true,
      immediate: true,
    };
  }

  // Escalade normale : un cran au-dessus de la derniere sanction.
  const last = input.history.at(-1);
  const lastIndex = last ? SANCTION_ORDER.indexOf(last) : -1;
  let nextIndex = Math.min(lastIndex + 1, SANCTION_ORDER.length - 1);

  // Plusieurs signalements confirmes coup sur coup : on saute un cran.
  if (input.recentConfirmedReports >= 3) {
    nextIndex = Math.min(nextIndex + 1, SANCTION_ORDER.length - 1);
  }

  const sanction = SANCTION_ORDER[nextIndex] ?? "WARNING";

  return {
    sanction,
    rationale:
      lastIndex < 0
        ? "Premier manquement confirmé : avertissement."
        : `Récidive après « ${SANCTION_LABEL[last!]} » : passage à « ${SANCTION_LABEL[sanction]} ».`,
    requiresHumanReview: sanction === "BAN",
    immediate: false,
  };
}

/** Priorite de traitement dans la file de moderation (§35). */
export function reportPriority(category: ReportCategory): "LOW" | "NORMAL" | "HIGH" | "CRITICAL" {
  switch (category) {
    case "UNDERAGE":
      return "CRITICAL";
    case "SCAM_MONEY":
    case "HARASSMENT":
      return "HIGH";
    case "FAKE_PROFILE":
    case "STOLEN_PHOTOS":
    case "INAPPROPRIATE":
      return "NORMAL";
    default:
      return "LOW";
  }
}

/** Delai de traitement cible, affiche a l'equipe et suivi en interne. */
export const SLA_HOURS: Record<ReturnType<typeof reportPriority>, number> = {
  CRITICAL: 2,
  HIGH: 12,
  NORMAL: 48,
  LOW: 96,
};

export function isZeroTolerance(category: ReportCategory): boolean {
  return ZERO_TOLERANCE.includes(category);
}
