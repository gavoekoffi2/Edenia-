import { productRules } from "@/lib/config/features";
import {
  faithDimension,
  familyDimension,
  lifestyleDimension,
  locationDimension,
  marriageDimension,
  personalityDimension,
  valuesDimension,
} from "./dimensions";
import { checkMutual, passesHardFilters } from "./dealbreakers";
import { DIMENSIONS, type Candidate, type DimensionKey, type DimensionResult, type MatchResult } from "./types";

/**
 * §20 — Compatibilite EDENIA.
 *
 * Trois garde-fous derivent directement du §21 et du §60 :
 *  1. un score n'est jamais affiche seul (voir explain.ts) ;
 *  2. il est plafonne (maxDisplayedCompatibility) — jamais 100 % ;
 *  3. une couverture de donnees faible abaisse la confiance ET le score, pour ne
 *     pas produire un « 95 % » a partir de trois champs remplis.
 */

/**
 * Poids de reference. La foi et la vision du mariage dominent : c'est la these
 * du produit (§65). Le mode de vie pese peu — c'est un sujet de conversation,
 * pas un facteur de reussite conjugale.
 */
export const BASE_WEIGHTS: Record<DimensionKey, number> = {
  faith: 0.24,
  marriage: 0.2,
  values: 0.15,
  family: 0.14,
  personality: 0.1,
  lifestyle: 0.07,
  location: 0.1,
};

/**
 * §22 : declarer un critere essentiel sur un theme signale que ce theme compte.
 * On renforce alors la dimension correspondante, sans jamais l'ecraser.
 */
const DEALBREAKER_TO_DIMENSION: Record<string, DimensionKey> = {
  WANTS_MARRIAGE: "marriage",
  WANTS_CHILDREN: "marriage",
  FAITH_PRACTICE: "faith",
  DENOMINATION: "faith",
  COUNTRY: "location",
  CITY: "location",
  EXPATRIATION: "marriage",
  FAMILY_VISION: "family",
  NO_CHILDREN_ALREADY: "family",
};

export function adaptiveWeights(viewer: Candidate): Record<DimensionKey, number> {
  const weights: Record<DimensionKey, number> = { ...BASE_WEIGHTS };

  for (const rule of viewer.dealbreakers) {
    const dimension = DEALBREAKER_TO_DIMENSION[rule.key];
    if (dimension) weights[dimension] += 0.03;
  }

  // Une priere declaree tres importante deplace le centre de gravite vers la foi.
  if ((viewer.faith.prayerImportance ?? 0) >= 5) weights.faith += 0.04;
  // Une recherche strictement locale rend la localisation plus determinante.
  if (viewer.preferences.scope === "CITY") weights.location += 0.04;

  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  for (const key of DIMENSIONS) {
    weights[key] = weights[key] / total;
  }
  return weights;
}

export function computeDimensions(a: Candidate, b: Candidate): Record<DimensionKey, DimensionResult> {
  return {
    faith: faithDimension(a, b),
    marriage: marriageDimension(a, b),
    values: valuesDimension(a, b),
    family: familyDimension(a, b),
    personality: personalityDimension(a, b),
    lifestyle: lifestyleDimension(a, b),
    location: locationDimension(a, b),
  };
}

export interface ScoreOptions {
  /** Applique les criteres essentiels (§22). Desactive pour un simple apercu. */
  applyDealbreakers?: boolean;
}

export function computeMatch(viewer: Candidate, target: Candidate, options: ScoreOptions = {}): MatchResult {
  const { applyDealbreakers = true } = options;
  const dimensions = computeDimensions(viewer, target);
  const weights = adaptiveWeights(viewer);

  let weightedSum = 0;
  let weightUsed = 0;
  let coverageSum = 0;

  for (const key of DIMENSIONS) {
    const dimension = dimensions[key];
    const weight = weights[key];
    coverageSum += dimension.coverage * weight;
    if (dimension.score === null) continue;
    weightedSum += dimension.score * weight;
    weightUsed += weight;
  }

  // Aucune dimension exploitable : on ne fabrique pas un chiffre.
  const rawScore = weightUsed > 0 ? weightedSum / weightUsed : 0;

  // La couverture globale tempere le resultat : a 40 % de couverture, le score
  // est tire vers une valeur neutre plutot que d'afficher une fausse certitude.
  const coverage = coverageSum;
  const tempered = rawScore * (0.7 + 0.3 * coverage);

  const confidence: MatchResult["confidence"] = coverage >= 0.7 ? "HIGH" : coverage >= 0.4 ? "MEDIUM" : "LOW";

  let score = Math.round(tempered * 100);
  score = Math.min(score, productRules.maxDisplayedCompatibility);
  score = Math.max(score, 0);

  let blocked = false;
  let blockedReasons: string[] = [];

  if (applyDealbreakers) {
    if (!passesHardFilters(viewer, target)) {
      blocked = true;
      blockedReasons = ["FILTRES_DE_BASE"];
    } else {
      const mutual = checkMutual(viewer, target);
      if (!mutual.passed) {
        blocked = true;
        blockedReasons = [...mutual.viewerReasons, ...mutual.targetReasons];
      }
    }
  }

  return { score, dimensions, weights, confidence, blocked, blockedReasons };
}

/** Score par dimension en pourcentage, pour l'affichage du §20. */
export function dimensionPercentages(result: MatchResult): Array<{ key: DimensionKey; percent: number | null }> {
  return DIMENSIONS.map((key) => {
    const dimension = result.dimensions[key];
    return {
      key,
      percent:
        dimension.score === null
          ? null
          : Math.min(productRules.maxDisplayedCompatibility, Math.round(dimension.score * 100)),
    };
  });
}
