/**
 * Primitives de similarite utilisees par les sept dimensions.
 * Toutes rendent soit un nombre dans [0, 1], soit `null` lorsque l'un des deux
 * cotes n'a pas repondu — un « je ne sais pas » ne doit jamais etre compte comme
 * un desaccord (§13).
 */

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * §13 — « L'IA ne doit jamais inventer ». Le corollaire cote matching : une
 * non-reponse assumee n'est pas un desaccord. « Je ne sais pas encore » et
 * « je prefere ne pas preciser » sont donc traites comme une absence de signal,
 * partout, plutot que comme une valeur qui differerait de toutes les autres.
 *
 * (Les criteres essentiels du §22 appliquent la regle inverse et assumee : un
 * critere eliminatoire ne peut pas etre valide par une non-reponse. Voir
 * dealbreakers.ts.)
 */
const NEUTRAL_VALUES = new Set(["UNDECIDED", "PREFER_NOT_SAY", "UNKNOWN", "NOT_SPECIFIED"]);

export function isNeutralAnswer(value: unknown): boolean {
  return typeof value === "string" && NEUTRAL_VALUES.has(value);
}

/** Similarite sur une echelle ordinale (ex. frequence de participation). */
export function ordinal<T extends string>(
  a: T | null | undefined,
  b: T | null | undefined,
  ranks: Record<T, number>,
): number | null {
  if (!a || !b || isNeutralAnswer(a) || isNeutralAnswer(b)) return null;
  const ra = ranks[a];
  const rb = ranks[b];
  if (ra === undefined || rb === undefined) return null;
  const values = Object.values(ranks) as number[];
  const span = Math.max(...values) - Math.min(...values);
  if (span === 0) return 1;
  return clamp01(1 - Math.abs(ra - rb) / span);
}

/** Similarite sur un axe continu deja normalise dans [0, 1]. */
export function axis(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return clamp01(1 - Math.abs(a - b));
}

/** Similarite sur une echelle numerique bornee (ex. importance 1-5). */
export function scaled(
  a: number | null | undefined,
  b: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const span = max - min;
  if (span <= 0) return 1;
  return clamp01(1 - Math.abs(a - b) / span);
}

/** Egalite stricte : 1 si identique, 0 sinon, null si l'un manque. */
export function exact<T>(a: T | null | undefined, b: T | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (isNeutralAnswer(a) || isNeutralAnswer(b)) return null;
  return a === b ? 1 : 0;
}

/**
 * Egalite « tolerante » : identique = 1, valeurs jugees proches = `nearValue`,
 * sinon 0. Sert la ou une difference n'est pas une incompatibilite.
 */
export function tolerant<T extends string>(
  a: T | null | undefined,
  b: T | null | undefined,
  nearGroups: readonly (readonly T[])[],
  nearValue = 0.7,
): number | null {
  if (!a || !b || isNeutralAnswer(a) || isNeutralAnswer(b)) return null;
  if (a === b) return 1;
  for (const group of nearGroups) {
    if (group.includes(a) && group.includes(b)) return nearValue;
  }
  return 0;
}

/** Recouvrement d'ensembles (centres d'interet). */
export function jaccard(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  const setA = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const setB = new Set(b.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return null;
  let inter = 0;
  for (const value of setA) if (setB.has(value)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? null : clamp01(inter / union);
}

export interface Signal {
  key: string;
  value: number | null;
  weight?: number;
}

export interface Aggregated {
  score: number | null;
  coverage: number;
}

/**
 * Moyenne ponderee ignorant les signaux absents, et renvoyant la couverture
 * effective. C'est le mecanisme qui empeche un profil peu rempli de produire un
 * score faussement precis.
 */
export function aggregate(signals: Signal[]): Aggregated {
  let sum = 0;
  let weightUsed = 0;
  let weightTotal = 0;

  for (const signal of signals) {
    const weight = signal.weight ?? 1;
    weightTotal += weight;
    if (signal.value === null) continue;
    sum += signal.value * weight;
    weightUsed += weight;
  }

  if (weightTotal === 0) return { score: null, coverage: 0 };
  if (weightUsed === 0) return { score: null, coverage: 0 };
  return { score: clamp01(sum / weightUsed), coverage: weightUsed / weightTotal };
}

/** Distance grand-cercle en km, sur des centroides de villes uniquement (§24). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
