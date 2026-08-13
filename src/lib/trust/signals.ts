/**
 * §34 — Anti-arnaque.
 *
 * Deux sorties bien distinctes, et c'est le point important (cf. C3) :
 *  - un **avertissement a l'utilisateur**, immediat et non stigmatisant ;
 *  - un **signal interne** pour la moderation, jamais affiche.
 *
 * Le score de confiance qui en decoule ne sort pas du back-office. Le §34 est
 * explicite : « Ne pas afficher publiquement un score de reputation negatif. »
 */

export type SignalKind =
  | "MONEY_REQUEST"
  | "MASS_MESSAGING"
  | "DUPLICATE_DEVICE"
  | "REPORTED"
  | "PHOTO_REUSE"
  | "RAPID_OFFPLATFORM"
  | "LANGUAGE_PATTERN"
  | "POSITIVE_VERIFIED"
  | "POSITIVE_LONGEVITY";

export interface DetectedSignal {
  kind: SignalKind;
  weight: number; // negatif = risque, positif = confiance
  detail: string;
  /** Extrait declencheur, conserve pour la moderation uniquement. */
  evidence?: string;
}

interface Detector {
  kind: SignalKind;
  weight: number;
  detail: string;
  patterns: RegExp[];
}

/**
 * Motifs observes dans les arnaques sentimentales en Afrique de l'Ouest :
 * demande d'argent, transfert Mobile Money, urgence medicale, frais de visa,
 * et sortie rapide de la plateforme.
 */
const DETECTORS: Detector[] = [
  {
    kind: "MONEY_REQUEST",
    weight: -30,
    detail: "Demande d'argent détectée dans un message.",
    patterns: [
      /\b(envoie|envoyer|virer|transf[ée]rer|d[ée]poser)[^.!?]{0,30}\b(argent|fcfa|cfa|euros?|dollars?)\b/i,
      /\b(t-?money|flooz|mobile\s*money|momo|orange\s*money|moov\s*money|wave)\b[^.!?]{0,40}\b(envoie|num[ée]ro|compte)\b/i,
      /\b(pr[êe]te?[- ]moi|besoin\s+d['’]argent|aide[- ]moi\s+financi[èe]rement)\b/i,
      /\b(frais\s+de\s+(?:visa|douane|transfert|dossier))\b/i,
      /\b(western\s*union|moneygram|ria)\b/i,
      /\b(carte\s+(?:de\s+)?recharge|code\s+de\s+recharge)\b/i,
    ],
  },
  {
    kind: "RAPID_OFFPLATFORM",
    weight: -8,
    detail: "Invitation très précoce à quitter la plateforme.",
    patterns: [
      /\b(whatsapp|t[ée]l[ée]gram|telegram|signal|snap(?:chat)?)\b[^.!?]{0,30}\b(num[ée]ro|contacte|[ée]cris)\b/i,
      /\b(donne[- ]moi\s+ton\s+num[ée]ro)\b/i,
    ],
  },
  {
    kind: "LANGUAGE_PATTERN",
    weight: -6,
    detail: "Formulations typiques des arnaques sentimentales.",
    patterns: [
      /\b(je\s+suis\s+bloqu[ée]\s+(?:à|a|en)\s+l['’][ée]tranger)\b/i,
      /\b(urgence\s+m[ée]dicale|hospitalis[ée]\s+d['’]urgence)\b/i,
      /\b(colis\s+bloqu[ée]|douane\s+r[ée]clame)\b/i,
      /\b(je\s+t['’]aime)\b[^.!?]{0,20}\b(d[ée]j[àa]|apr[èe]s\s+un\s+jour)\b/i,
    ],
  },
];

export interface MessageScanResult {
  signals: DetectedSignal[];
  /** Avertissement a montrer immediatement au destinataire (§34). */
  userWarning: string | null;
  /** True si le message merite une revue humaine. */
  flagForReview: boolean;
}

export const MONEY_WARNING =
  "⚠️ Ne transférez jamais d'argent à une personne rencontrée sur EDENIA, quelle que soit la raison invoquée. " +
  "Si on vous en demande, signalez-le : c'est le signalement le plus utile que vous puissiez faire.";

const OFFPLATFORM_WARNING =
  "Prenez le temps. Rien ne vous oblige à donner un numéro personnel : la conversation EDENIA reste protégée et modérée.";

export function scanMessage(text: string): MessageScanResult {
  const signals: DetectedSignal[] = [];

  for (const detector of DETECTORS) {
    for (const pattern of detector.patterns) {
      const match = pattern.exec(text);
      if (match) {
        signals.push({
          kind: detector.kind,
          weight: detector.weight,
          detail: detector.detail,
          evidence: match[0],
        });
        break; // un signal par detecteur suffit
      }
    }
  }

  const hasMoney = signals.some((s) => s.kind === "MONEY_REQUEST");
  const hasOffPlatform = signals.some((s) => s.kind === "RAPID_OFFPLATFORM");

  return {
    signals,
    userWarning: hasMoney ? MONEY_WARNING : hasOffPlatform ? OFFPLATFORM_WARNING : null,
    flagForReview: hasMoney || signals.length >= 2,
  };
}

// ---------------------------------------------------------------------------
// Score de confiance interne
// ---------------------------------------------------------------------------

export interface TrustInputs {
  signals: Array<{ kind: SignalKind; weight: number; createdAt: Date }>;
  phoneVerified: boolean;
  identityVerified: boolean;
  profileVerified: boolean;
  accountAgeDays: number;
  reportsReceived: number;
  now?: Date;
}

export const TRUST_BASELINE = 50;

/**
 * §34 — score interne, borne [0, 100].
 *
 * Les signaux s'estompent avec le temps : un incident vieux de six mois ne pese
 * plus autant qu'un incident d'hier, sinon un compte ne pourrait jamais se
 * racheter.
 */
export function computeTrustScore(inputs: TrustInputs): number {
  const now = inputs.now ?? new Date();
  let score = TRUST_BASELINE;

  for (const signal of inputs.signals) {
    const ageDays = (now.getTime() - signal.createdAt.getTime()) / 86_400_000;
    const decay = Math.exp(-ageDays / 120); // demi-vie ~83 jours
    score += signal.weight * decay;
  }

  if (inputs.phoneVerified) score += 8;
  if (inputs.identityVerified) score += 20;
  if (inputs.profileVerified) score += 12;

  score += Math.min(10, inputs.accountAgeDays / 30);
  score -= inputs.reportsReceived * 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export type TrustBand = "CRITICAL" | "AT_RISK" | "NEUTRAL" | "TRUSTED";

export function trustBand(score: number): TrustBand {
  if (score < 20) return "CRITICAL";
  if (score < 40) return "AT_RISK";
  if (score < 70) return "NEUTRAL";
  return "TRUSTED";
}

/**
 * Effet du score sur le produit. Il n'apparait jamais tel quel : il module la
 * visibilite et declenche des revues, c'est tout.
 */
export function trustEffects(score: number): {
  reduceVisibility: boolean;
  requireReviewBeforeChat: boolean;
  blockNewMatches: boolean;
} {
  const band = trustBand(score);
  return {
    reduceVisibility: band === "AT_RISK" || band === "CRITICAL",
    requireReviewBeforeChat: band === "CRITICAL",
    blockNewMatches: band === "CRITICAL",
  };
}
