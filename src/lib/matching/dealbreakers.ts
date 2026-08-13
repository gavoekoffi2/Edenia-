import {
  COMMITMENT_RANK,
  DEALBREAKER_LABEL,
  type CommitmentLevel,
  type DealbreakerKey,
} from "@/lib/config/enums";
import type { Candidate, DealbreakerRule } from "./types";

/**
 * §22 — l'algorithme doit distinguer **preference** et **critere essentiel**.
 *
 * - Une preference influence le score (voir dimensions.ts).
 * - Un critere essentiel est **eliminatoire** : il ne baisse pas le score, il
 *   retire la personne des resultats.
 *
 * La verification est **bilaterale** : les criteres essentiels de la personne
 * regardee comptent autant que ceux de la personne qui cherche. Sans cela, on
 * proposerait a un utilisateur des profils qui l'excluent d'office — la premiere
 * cause de frustration dans ce type de produit.
 */

export interface DealbreakerCheck {
  passed: boolean;
  /** Motifs formules du point de vue du **titulaire** du critere. */
  reasons: string[];
}

/** Extrait la valeur du candidat correspondant a une cle de critere essentiel. */
function extract(key: DealbreakerKey, target: Candidate): unknown {
  switch (key) {
    case "WANTS_MARRIAGE":
      return target.marriage.wantsMarriage;
    case "WANTS_CHILDREN":
      return target.marriage.wantsChildren;
    case "FAITH_PRACTICE":
      return target.faith.commitmentLevel;
    case "DENOMINATION":
      return target.faith.denomination;
    case "COUNTRY":
      return target.location.countryCode;
    case "CITY":
      return target.location.cityId;
    case "EXPATRIATION":
      return target.marriage.expatriation;
    case "FAMILY_VISION":
      return target.family.extendedFamilySupport;
    case "NO_CHILDREN_ALREADY":
      return target.core.hasChildren;
    default:
      return null;
  }
}

function evaluate(rule: DealbreakerRule, actual: unknown): boolean {
  // §13 : une valeur inconnue ne peut pas etre declaree conforme. Elle echoue le
  // critere essentiel — mais la personne reste visible dans les rails ou aucun
  // critere n'est applique, et peut completer son profil pour reapparaitre.
  if (actual === null || actual === undefined || actual === "UNDECIDED") {
    return false;
  }

  switch (rule.operator) {
    case "EQUALS":
      return actual === rule.value;
    case "NOT_EQUALS":
      return actual !== rule.value;
    case "IN":
      return Array.isArray(rule.value) && rule.value.includes(actual);
    case "AT_LEAST": {
      const ranks = COMMITMENT_RANK as Record<string, number>;
      const actualRank = ranks[String(actual)];
      const expectedRank = ranks[String(rule.value)];
      if (actualRank === undefined || expectedRank === undefined) {
        const an = Number(actual);
        const en = Number(rule.value);
        return Number.isFinite(an) && Number.isFinite(en) && an >= en;
      }
      return actualRank >= expectedRank;
    }
    case "AT_MOST": {
      const ranks = COMMITMENT_RANK as Record<CommitmentLevel, number> as Record<string, number>;
      const actualRank = ranks[String(actual)];
      const expectedRank = ranks[String(rule.value)];
      if (actualRank === undefined || expectedRank === undefined) {
        const an = Number(actual);
        const en = Number(rule.value);
        return Number.isFinite(an) && Number.isFinite(en) && an <= en;
      }
      return actualRank <= expectedRank;
    }
    default:
      return false;
  }
}

/** Applique les criteres essentiels de `holder` au profil `target`. */
export function checkOneWay(holder: Candidate, target: Candidate): DealbreakerCheck {
  const reasons: string[] = [];

  for (const rule of holder.dealbreakers) {
    const key = rule.key as DealbreakerKey;
    const actual = extract(key, target);

    // Cas special : « sans enfant a ce jour » est exprime positivement en base.
    if (key === "NO_CHILDREN_ALREADY") {
      if (target.core.hasChildren) {
        reasons.push(DEALBREAKER_LABEL[key] ?? key);
      }
      continue;
    }

    if (!evaluate(rule, actual)) {
      reasons.push(DEALBREAKER_LABEL[key] ?? key);
    }
  }

  return { passed: reasons.length === 0, reasons };
}

export interface MutualDealbreakerResult {
  passed: boolean;
  /** Criteres du chercheur que la cible ne satisfait pas. */
  viewerReasons: string[];
  /** Criteres de la cible que le chercheur ne satisfait pas. */
  targetReasons: string[];
}

export function checkMutual(viewer: Candidate, target: Candidate): MutualDealbreakerResult {
  const forward = checkOneWay(viewer, target);
  const backward = checkOneWay(target, viewer);
  return {
    passed: forward.passed && backward.passed,
    viewerReasons: forward.reasons,
    targetReasons: backward.reasons,
  };
}

/**
 * Filtres durs non negociables, independants des criteres utilisateurs :
 * age legal, genre recherche, plage d'age souhaitee, statut du compte.
 * §60 : ils ne sont jamais presentes comme un « rejet » a l'utilisateur.
 */
export function passesHardFilters(viewer: Candidate, target: Candidate): boolean {
  if (viewer.core.userId === target.core.userId) return false;
  if (target.core.gender !== viewer.core.seeking) return false;
  if (viewer.core.gender !== target.core.seeking) return false;
  if (target.core.age < viewer.preferences.ageMin || target.core.age > viewer.preferences.ageMax) return false;
  if (viewer.core.age < target.preferences.ageMin || viewer.core.age > target.preferences.ageMax) return false;
  if (!target.core.isVerifiedContact) return false;
  return true;
}
