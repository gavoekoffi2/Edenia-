import type { Visibility } from "@/lib/config/enums";
import { DIMENSIONS, DIMENSION_LABEL, type Candidate, type DimensionKey, type MatchResult } from "./types";

/**
 * §21 — « Ne pas seulement afficher 89 % ».
 *
 * Deux contraintes se croisent ici :
 *  - il faut expliquer le score en langage clair ;
 *  - il ne faut pas divulguer les reponses privees de l'autre personne (C5).
 *
 * La visibilite est donc appliquee **par dimension** : si la personne regardee a
 * marque « Vision du mariage » comme privee, l'explication ne peut pas dire ce
 * qu'elle a repondu ; elle propose seulement le sujet comme piste de discussion.
 */

export interface MatchExplanation {
  /** Ex. « Compatibilité EDENIA — 89 % ». */
  headline: string;
  score: number;
  /** « Pourquoi cette personne ? » */
  why: string[];
  /** « Points à découvrir » */
  toDiscover: string[];
  /** §21 : le score n'est jamais presente comme une verite. */
  disclaimer: string;
  confidence: MatchResult["confidence"];
  /** Message affiche quand le profil est trop peu rempli pour conclure. */
  lowDataNotice: string | null;
}

const DEFAULT_VISIBILITY: Visibility = "PUBLIC";

function visibilityFor(candidate: Candidate, key: DimensionKey): Visibility {
  return (candidate.visibility[key] as Visibility | undefined) ?? DEFAULT_VISIBILITY;
}

function canReveal(target: Candidate, key: DimensionKey, isMatched: boolean): boolean {
  const visibility = visibilityFor(target, key);
  if (visibility === "PUBLIC") return true;
  if (visibility === "MATCHES") return isMatched;
  return false;
}

export interface ExplainOptions {
  /** True une fois le match mutuel etabli : davantage d'elements deviennent visibles. */
  isMatched?: boolean;
  maxWhy?: number;
  maxToDiscover?: number;
}

export function explainMatch(
  viewer: Candidate,
  target: Candidate,
  result: MatchResult,
  options: ExplainOptions = {},
): MatchExplanation {
  const { isMatched = false, maxWhy = 3, maxToDiscover = 2 } = options;

  // Les dimensions les plus fortes d'abord : l'explication suit le score, elle ne
  // le contredit pas.
  const ranked = [...DIMENSIONS].sort((a, b) => {
    const sa = result.dimensions[a].score ?? -1;
    const sb = result.dimensions[b].score ?? -1;
    return sb - sa;
  });

  const why: string[] = [];
  const toDiscover: string[] = [];
  const hiddenTopics: string[] = [];

  for (const key of ranked) {
    const dimension = result.dimensions[key];
    if (dimension.score === null) continue;

    const revealable = canReveal(target, key, isMatched);

    if (dimension.score >= 0.75 && dimension.positives.length > 0) {
      if (revealable) {
        for (const fact of dimension.positives) {
          if (why.length < maxWhy && !why.includes(fact)) why.push(fact);
        }
      } else if (!hiddenTopics.includes(DIMENSION_LABEL[key])) {
        hiddenTopics.push(DIMENSION_LABEL[key]);
      }
    }
  }

  for (const key of [...ranked].reverse()) {
    const dimension = result.dimensions[key];
    if (dimension.score === null) continue;
    if (dimension.score >= 0.6) continue;

    const revealable = canReveal(target, key, isMatched);
    if (revealable && dimension.gaps.length > 0) {
      for (const gap of dimension.gaps) {
        if (toDiscover.length < maxToDiscover && !toDiscover.includes(gap)) toDiscover.push(gap);
      }
    } else if (toDiscover.length < maxToDiscover) {
      // C5 : formulation neutre, qui ne revele rien de la reponse de l'autre.
      const neutral = `« ${DIMENSION_LABEL[key]} » est un sujet que vous pourriez aborder ensemble.`;
      if (!toDiscover.includes(neutral)) toDiscover.push(neutral);
    }
  }

  // Aucune dimension incomplete a signaler : on propose quand meme une piste.
  if (toDiscover.length === 0) {
    toDiscover.push("Vous n'avez pas encore échangé sur vos projets à court terme.");
  }

  if (why.length === 0) {
    why.push(
      hiddenTopics.length > 0
        ? `Vous avez des points communs sur : ${hiddenTopics.slice(0, 2).join(", ")}.`
        : "Vous partagez la recherche d'une relation sérieuse fondée sur la foi.",
    );
  }

  const lowDataNotice =
    result.confidence === "LOW"
      ? "Ce score est encore approximatif : l'un de vos deux profils est peu complété."
      : null;

  return {
    headline: `Compatibilité EDENIA — ${result.score} %`,
    score: result.score,
    why,
    toDiscover,
    disclaimer:
      "Ce score est indicatif. Il reflète ce que vous avez déclaré tous les deux, pas la réussite d'une relation.",
    confidence: result.confidence,
    lowDataNotice,
  };
}

/**
 * §33 — questions de mise en relation apres un match. Elles sont choisies sur les
 * dimensions les moins couvertes : la conversation sert a combler ce que le
 * questionnaire n'a pas su capter.
 */
const ICEBREAKERS: Partial<Record<DimensionKey, { theme: string; question: string }>> = {
  faith: {
    theme: "Foi",
    question: "Quelle place aimerais-tu donner à la foi dans ton futur couple ?",
  },
  family: {
    theme: "Famille",
    question: "Quelle place ta famille occupe-t-elle dans ton projet de mariage ?",
  },
  marriage: {
    theme: "Projet",
    question: "Où aimerais-tu construire ton foyer dans les prochaines années ?",
  },
  values: {
    theme: "Valeurs",
    question: "Qu'est-ce qui compte le plus pour toi dans la manière de faire tourner un foyer ?",
  },
  lifestyle: {
    theme: "Quotidien",
    question: "À quoi ressemble une journée qui te fait du bien ?",
  },
  personality: {
    theme: "Caractère",
    question: "Comment réagis-tu quand un désaccord s'installe ?",
  },
  location: {
    theme: "Lieu de vie",
    question: "Te vois-tu rester dans ta ville actuelle sur le long terme ?",
  },
};

export function suggestIcebreakers(result: MatchResult, limit = 3): Array<{ theme: string; question: string }> {
  const ordered = [...DIMENSIONS].sort((a, b) => {
    const ca = result.dimensions[a].coverage;
    const cb = result.dimensions[b].coverage;
    return ca - cb;
  });

  const out: Array<{ theme: string; question: string }> = [];
  for (const key of ordered) {
    const suggestion = ICEBREAKERS[key];
    if (suggestion && out.length < limit) out.push(suggestion);
  }
  return out;
}
