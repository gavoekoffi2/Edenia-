import {
  ATTENDANCE_RANK,
  BIBLE_READING_RANK,
  COMMITMENT_RANK,
  EXPATRIATION_AXIS,
  EXTENDED_SUPPORT_AXIS,
  TIMELINE_MONTHS,
  type Denomination,
} from "@/lib/config/enums";
import type { Candidate, DimensionResult } from "./types";
import { aggregate, axis, clamp01, exact, haversineKm, jaccard, ordinal, scaled, tolerant } from "./similarity";

/**
 * Les sept dimensions du §20. Chacune produit un score, une couverture, et surtout
 * des **faits** (positives / gaps) qui alimenteront l'explication du §21 : le score
 * seul n'a aucune valeur pedagogique.
 */

// --- Foi (§17) -------------------------------------------------------------

/**
 * Familles doctrinales proches. Le but n'est pas de hierarchiser des Eglises mais
 * de reconnaitre que la distance vecue entre, par exemple, evangelique et
 * pentecotiste est plus faible qu'entre catholique et pentecotiste.
 */
const DENOMINATION_NEIGHBOURS: readonly (readonly Denomination[])[] = [
  ["EVANGELICAL", "PENTECOSTAL", "BAPTIST", "METHODIST", "PROTESTANT"],
  ["CATHOLIC", "ORTHODOX"],
];

export function faithDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const denom = tolerant<Denomination>(
    a.faith.denomination === "PREFER_NOT_SAY" ? null : a.faith.denomination,
    b.faith.denomination === "PREFER_NOT_SAY" ? null : b.faith.denomination,
    DENOMINATION_NEIGHBOURS,
    0.75,
  );
  const commitment = ordinal(a.faith.commitmentLevel, b.faith.commitmentLevel, COMMITMENT_RANK);
  const attendance = ordinal(a.faith.attendance, b.faith.attendance, ATTENDANCE_RANK);
  const prayer = scaled(a.faith.prayerImportance, b.faith.prayerImportance, 1, 5);
  const bible = ordinal(a.faith.bibleReading, b.faith.bibleReading, BIBLE_READING_RANK);

  if (denom === 1) positives.push("Vous appartenez à la même dénomination.");
  else if (denom !== null && denom >= 0.7) positives.push("Vos dénominations sont proches.");
  else if (denom === 0) gaps.push("Vos dénominations sont différentes.");

  if (commitment !== null && commitment >= 0.75) {
    positives.push("Vous vivez votre engagement chrétien avec la même intensité.");
  } else if (commitment !== null && commitment < 0.4) {
    gaps.push("Votre niveau d'engagement dans l'Église n'est pas le même.");
  }

  if (prayer !== null && prayer >= 0.8 && (a.faith.prayerImportance ?? 0) >= 4) {
    positives.push("La prière tient une place importante pour vous deux.");
  }
  if (attendance !== null && attendance >= 0.75) {
    positives.push("Vous participez au culte à un rythme comparable.");
  }
  if (bible !== null && bible < 0.4) {
    gaps.push("Votre rapport à la lecture biblique diffère.");
  }

  const { score, coverage } = aggregate([
    { key: "denomination", value: denom, weight: 2 },
    { key: "commitment", value: commitment, weight: 3 },
    { key: "attendance", value: attendance, weight: 2 },
    { key: "prayer", value: prayer, weight: 2 },
    { key: "bible", value: bible, weight: 1 },
  ]);

  return { score, coverage, positives, gaps };
}

// --- Vision du mariage (§18) ----------------------------------------------

export function marriageDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  // Souhait de mariage : YES/PROBABLY sont compatibles, UNDECIDED reste neutre.
  const marriageWish = tolerant(a.marriage.wantsMarriage, b.marriage.wantsMarriage, [["YES", "PROBABLY"]], 0.8);

  // Horizon : compare en mois, sur un empan de 10 ans.
  const monthsA = a.marriage.timeline ? TIMELINE_MONTHS[a.marriage.timeline] : null;
  const monthsB = b.marriage.timeline ? TIMELINE_MONTHS[b.marriage.timeline] : null;
  const timeline = scaled(monthsA, monthsB, 0, 120);

  const children = exact(a.marriage.wantsChildren, b.marriage.wantsChildren);
  const childrenCount = scaled(a.marriage.childrenDesired, b.marriage.childrenDesired, 0, 8);
  const residence = exact(a.marriage.residenceAfter, b.marriage.residenceAfter);
  const expat = axis(
    a.marriage.expatriation ? EXPATRIATION_AXIS[a.marriage.expatriation] : null,
    b.marriage.expatriation ? EXPATRIATION_AXIS[b.marriage.expatriation] : null,
  );

  if (marriageWish !== null && marriageWish >= 0.8) {
    positives.push("Vous recherchez tous les deux une relation orientée vers le mariage.");
  }
  if (timeline !== null && timeline >= 0.85) {
    positives.push("Vous envisagez le mariage dans un horizon de temps similaire.");
  } else if (timeline !== null && timeline < 0.5) {
    gaps.push("Votre horizon de temps pour le mariage n'est pas le même.");
  }
  if (children === 1 && a.marriage.wantsChildren === "YES") {
    positives.push("Vous souhaitez tous les deux avoir des enfants.");
  } else if (children === 0) {
    gaps.push("Votre position sur le désir d'enfants diffère.");
  }
  if (expat !== null && expat < 0.5) {
    gaps.push("Votre vision de l'expatriation n'est pas la même.");
  } else if (expat !== null && expat >= 0.85) {
    positives.push("Vous avez la même vision quant à vivre en Afrique ou à l'étranger.");
  }

  const { score, coverage } = aggregate([
    { key: "wantsMarriage", value: marriageWish, weight: 3 },
    { key: "timeline", value: timeline, weight: 2 },
    { key: "wantsChildren", value: children, weight: 3 },
    { key: "childrenDesired", value: childrenCount, weight: 1 },
    { key: "residenceAfter", value: residence, weight: 1 },
    { key: "expatriation", value: expat, weight: 2 },
  ]);

  return { score, coverage, positives, gaps };
}

// --- Valeurs ---------------------------------------------------------------

/**
 * « Valeurs » au sens du §20 : le systeme de reperes partage — rapport a la
 * tradition, a l'argent, au travail de chacun, et place voulue pour la foi dans
 * le couple. Distinct de la foi (pratique) et du projet familial (organisation).
 */
export function valuesDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const traditions = scaled(a.family.traditionsImportance, b.family.traditionsImportance, 1, 5);
  const finance = tolerant(a.marriage.financeModel, b.marriage.financeModel, [["POOLED", "MIXED"], ["SEPARATE", "MIXED"]], 0.6);
  const career = tolerant(a.marriage.careerView, b.marriage.careerView, [["BOTH_CAREERS", "FLEXIBLE"], ["ONE_FOCUS_HOME", "FLEXIBLE"]], 0.6);
  const dowry = exact(a.family.dowryView, b.family.dowryView);
  const faithInCouple = keywordOverlap(a.faith.faithInCouple, b.faith.faithInCouple);

  if (traditions !== null && traditions >= 0.8) {
    positives.push("Vous accordez une importance comparable aux traditions.");
  } else if (traditions !== null && traditions < 0.5) {
    gaps.push("Votre rapport aux traditions n'est pas le même.");
  }
  if (finance === 1) positives.push("Vous envisagez la gestion financière du foyer de la même façon.");
  else if (finance === 0) gaps.push("Votre approche des finances du couple diffère.");
  if (career !== null && career < 0.5) {
    gaps.push("Votre vision de la place du travail de chacun diffère.");
  }
  if (faithInCouple !== null && faithInCouple >= 0.4) {
    positives.push("Vous décrivez la place de la foi dans le couple en des termes proches.");
  }

  const { score, coverage } = aggregate([
    { key: "traditions", value: traditions, weight: 2 },
    { key: "finance", value: finance, weight: 2 },
    { key: "career", value: career, weight: 2 },
    { key: "dowry", value: dowry, weight: 1 },
    { key: "faithInCouple", value: faithInCouple, weight: 2 },
  ]);

  return { score, coverage, positives, gaps };
}

// --- Projet familial (§19) -------------------------------------------------

export function familyDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const proximity = exact(a.family.familyProximity, b.family.familyProximity);
  const support = axis(
    a.family.extendedFamilySupport ? EXTENDED_SUPPORT_AXIS[a.family.extendedFamilySupport] : null,
    b.family.extendedFamilySupport ? EXTENDED_SUPPORT_AXIS[b.family.extendedFamilySupport] : null,
  );
  const inLaws = exact(a.family.inLawsRole, b.family.inLawsRole);

  // Ouverture reciproque aux enfants deja nes : c'est une compatibilite, pas un jugement.
  const childrenFit = childrenOpennessScore(a, b);

  if (support !== null && support >= 0.8) {
    positives.push("Vous voyez de la même manière le soutien à la famille élargie.");
  } else if (support !== null && support < 0.5) {
    gaps.push("Votre vision du soutien à la famille élargie n'est pas la même.");
  }
  if (proximity === 1) positives.push("Vous souhaitez la même proximité géographique avec vos familles.");
  if (inLaws === 1) positives.push("Vous imaginez le même rôle pour la belle-famille.");
  if (childrenFit !== null && childrenFit < 0.5) {
    gaps.push("La présence d'enfants déjà nés est un point à clarifier ensemble.");
  }

  const { score, coverage } = aggregate([
    { key: "familyProximity", value: proximity, weight: 2 },
    { key: "extendedSupport", value: support, weight: 3 },
    { key: "inLawsRole", value: inLaws, weight: 2 },
    { key: "childrenOpenness", value: childrenFit, weight: 2 },
  ]);

  return { score, coverage, positives, gaps };
}

function childrenOpennessScore(a: Candidate, b: Candidate): number | null {
  const aOk = b.core.hasChildren ? (a.preferences.openToChildren ? 1 : 0) : null;
  const bOk = a.core.hasChildren ? (b.preferences.openToChildren ? 1 : 0) : null;
  if (aOk === null && bOk === null) return null;
  const values = [aOk, bOk].filter((v): v is number => v !== null);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// --- Personnalite ----------------------------------------------------------

/**
 * Similarite sur la rigueur, l'amabilite et l'ouverture ; **complementarite
 * moderee** toleree sur l'extraversion (deux profils tres differents sur cet axe
 * ne sont pas incompatibles). L'ecart d'emotivite est le signal le plus lie aux
 * frictions, il pese donc davantage.
 */
export function personalityDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const openness = scaled(a.personality.openness, b.personality.openness, 0, 100);
  const conscientiousness = scaled(a.personality.conscientiousness, b.personality.conscientiousness, 0, 100);
  const agreeableness = scaled(a.personality.agreeableness, b.personality.agreeableness, 0, 100);
  const emotionality = scaled(a.personality.emotionality, b.personality.emotionality, 0, 100);

  // Extraversion : on n'exige pas la ressemblance, on penalise seulement les extremes opposes.
  let extraversion: number | null = null;
  if (a.personality.extraversion !== null && b.personality.extraversion !== null) {
    const diff = Math.abs(a.personality.extraversion - b.personality.extraversion) / 100;
    extraversion = clamp01(1 - Math.max(0, diff - 0.35) / 0.65);
  }

  const conflict = exact(a.personality.conflictStyle, b.personality.conflictStyle);

  if (conscientiousness !== null && conscientiousness >= 0.8) {
    positives.push("Vous avez une manière comparable d'organiser votre quotidien.");
  }
  if (conflict === 1) positives.push("Vous gérez les désaccords de la même façon.");
  else if (conflict === 0) gaps.push("Vous n'abordez pas les désaccords de la même manière.");
  if (emotionality !== null && emotionality < 0.5) {
    gaps.push("Votre sensibilité émotionnelle s'exprime différemment.");
  }

  const { score, coverage } = aggregate([
    { key: "openness", value: openness, weight: 1 },
    { key: "conscientiousness", value: conscientiousness, weight: 2 },
    { key: "agreeableness", value: agreeableness, weight: 2 },
    { key: "emotionality", value: emotionality, weight: 2 },
    { key: "extraversion", value: extraversion, weight: 1 },
    { key: "conflictStyle", value: conflict, weight: 2 },
  ]);

  return { score, coverage, positives, gaps };
}

// --- Mode de vie -----------------------------------------------------------

export function lifestyleDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const interests = jaccard(a.lifestyle.interests, b.lifestyle.interests);
  const smoking = exact(a.lifestyle.smoking, b.lifestyle.smoking);
  const alcohol = exact(a.lifestyle.alcohol, b.lifestyle.alcohol);
  const social = exact(a.lifestyle.socialStyle, b.lifestyle.socialStyle);

  const shared = sharedInterests(a.lifestyle.interests, b.lifestyle.interests);
  if (shared.length > 0) {
    positives.push(`Vous partagez ${shared.length > 2 ? "plusieurs centres d'intérêt" : "des centres d'intérêt"} : ${shared.slice(0, 3).join(", ")}.`);
  }
  if (smoking === 0) gaps.push("Votre rapport au tabac diffère.");

  const { score, coverage } = aggregate([
    { key: "interests", value: interests, weight: 3 },
    { key: "smoking", value: smoking, weight: 2 },
    { key: "alcohol", value: alcohol, weight: 1 },
    { key: "socialStyle", value: social, weight: 2 },
  ]);

  return { score, coverage, positives, gaps };
}

export function sharedInterests(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((x) => x.trim().toLowerCase()));
  return a.filter((x) => setB.has(x.trim().toLowerCase()));
}

// --- Localisation (§24) ----------------------------------------------------

/**
 * §24 + C4 : on raisonne sur la hierarchie administrative. Les centroides de villes
 * ne servent qu'a departager deux villes d'une meme region ; aucune position
 * d'utilisateur n'est utilisee ni exposee.
 */
export function locationDimension(a: Candidate, b: Candidate): DimensionResult {
  const positives: string[] = [];
  const gaps: string[] = [];

  const la = a.location;
  const lb = b.location;

  if (!la.countryCode || !lb.countryCode) {
    return { score: null, coverage: 0, positives, gaps };
  }

  let score: number;

  if (la.cityId && lb.cityId && la.cityId === lb.cityId) {
    score = 1;
    positives.push("Vous vivez dans la même ville.");
  } else if (la.regionId && lb.regionId && la.regionId === lb.regionId) {
    score = 0.85;
    positives.push("Vous vivez dans la même région.");
  } else if (la.countryCode === lb.countryCode) {
    score = 0.7;
    positives.push("Vous vivez dans le même pays.");
    if (la.cityLat !== null && la.cityLng !== null && lb.cityLat !== null && lb.cityLng !== null) {
      const km = haversineKm(la.cityLat, la.cityLng, lb.cityLat, lb.cityLng);
      // Un ecart intra-national reste penalise progressivement jusqu'a 800 km.
      score = clamp01(0.7 + 0.15 * (1 - Math.min(1, km / 800)));
    }
  } else if (la.isDiaspora !== lb.isDiaspora) {
    // §23 : la diaspora est un cas explicitement voulu, pas une penalite brute.
    const openness = (la.isDiaspora ? b.preferences.openToDiaspora : a.preferences.openToDiaspora) ? 0.55 : 0.2;
    score = openness;
    if (openness >= 0.5) positives.push("Une relation entre l'Afrique et la diaspora vous est ouverte.");
    else gaps.push("Vous ne vivez pas sur le même continent.");
  } else {
    score = 0.35;
    gaps.push("Vous ne vivez pas dans le même pays.");
  }

  return { score, coverage: 1, positives, gaps };
}

// --- Utilitaire ------------------------------------------------------------

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux",
  "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "que", "qui", "dans",
  "pour", "avec", "mon", "ma", "mes", "son", "sa", "ses", "notre", "votre", "leur",
  "est", "sont", "etre", "avoir", "plus", "tres", "pas", "ne", "en", "ce", "cette",
]);

/** Recouvrement lexical grossier entre deux textes libres — suffisant comme signal faible. */
export function keywordOverlap(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const norm = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const wordsA = norm(a);
  const wordsB = norm(b);
  return jaccard(wordsA, wordsB);
}
