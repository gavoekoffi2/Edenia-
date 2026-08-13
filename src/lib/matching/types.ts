import type {
  Attendance,
  BibleReading,
  CareerView,
  CommitmentLevel,
  Denomination,
  Education,
  Expatriation,
  ExtendedSupport,
  FinanceModel,
  Gender,
  MaritalStatus,
  ResidenceAfter,
  Scope,
  Timeline,
  TriState,
  Visibility,
  WantsMarriage,
} from "@/lib/config/enums";

/**
 * Instantane d'un profil tel que le moteur de matching le consomme.
 *
 * Le moteur est volontairement **pur** : il ne connait ni Prisma, ni HTTP, ni React.
 * C'est ce qui permet de le tester exhaustivement (tests/matching.test.ts) et, plus
 * tard, de l'extraire en service independant (§48).
 */

export interface CoreFacet {
  userId: string;
  gender: Gender;
  seeking: Gender;
  age: number;
  maritalStatus: MaritalStatus;
  hasChildren: boolean;
  childrenCount: number;
  education: Education | null;
  /** §26 : un profil sans canal verifie n'entre pas dans la decouverte. */
  isVerifiedContact: boolean;
  hasVerifiedIdentity: boolean;
  hasVerifiedProfile: boolean;
  hasVerifiedChurch: boolean;
  /** Ancienneté en jours, utilisee par le rail « Nouveaux profils ». */
  ageOfAccountDays: number;
  lastActiveDaysAgo: number;
}

export interface FaithFacet {
  denomination: Denomination | null;
  commitmentLevel: CommitmentLevel | null;
  attendance: Attendance | null;
  prayerImportance: number | null; // 1-5
  bibleReading: BibleReading | null;
  /** Texte libre : la place voulue pour la foi dans le couple (§17). */
  faithInCouple: string | null;
}

export interface MarriageFacet {
  wantsMarriage: WantsMarriage | null;
  timeline: Timeline | null;
  wantsChildren: TriState | null;
  childrenDesired: number | null;
  financeModel: FinanceModel | null;
  careerView: CareerView | null;
  residenceAfter: ResidenceAfter | null;
  expatriation: Expatriation | null;
  countryAfter: string | null;
}

export interface FamilyFacet {
  familyProximity: string | null;
  extendedFamilySupport: ExtendedSupport | null;
  traditionsImportance: number | null; // 1-5
  inLawsRole: string | null;
  dowryView: string | null;
}

export interface PersonalityFacet {
  openness: number | null; // 0-100
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  emotionality: number | null;
  conflictStyle: string | null;
}

export interface LifestyleFacet {
  interests: string[];
  smoking: string | null;
  alcohol: string | null;
  socialStyle: string | null;
}

/**
 * §24 : granularite maximale = la ville. Aucune coordonnee utilisateur ici —
 * `cityLat`/`cityLng` sont le centroide de la ville, une donnee publique.
 */
export interface LocationFacet {
  countryCode: string | null;
  regionId: string | null;
  cityId: string | null;
  cityLat: number | null;
  cityLng: number | null;
  isDiaspora: boolean;
}

export interface PreferencesFacet {
  ageMin: number;
  ageMax: number;
  scope: Scope;
  distanceKm: number | null;
  countries: string[];
  denominations: Denomination[];
  openToDiaspora: boolean;
  openToChildren: boolean;
  educationMin: Education | null;
}

export interface DealbreakerRule {
  key: string;
  operator: string;
  value: unknown;
}

/** Visibilite par champ (§47, C5) : conditionne ce que l'explication peut dire. */
export type VisibilityMap = Record<string, Visibility>;

export interface Candidate {
  core: CoreFacet;
  faith: FaithFacet;
  marriage: MarriageFacet;
  family: FamilyFacet;
  personality: PersonalityFacet;
  lifestyle: LifestyleFacet;
  location: LocationFacet;
  preferences: PreferencesFacet;
  dealbreakers: DealbreakerRule[];
  visibility: VisibilityMap;
}

export const DIMENSIONS = [
  "faith",
  "marriage",
  "values",
  "family",
  "personality",
  "lifestyle",
  "location",
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  faith: "Foi",
  marriage: "Vision du mariage",
  values: "Valeurs",
  family: "Projet familial",
  personality: "Personnalité",
  lifestyle: "Mode de vie",
  location: "Localisation",
};

export interface DimensionResult {
  /** 0-1, ou null si les donnees sont insuffisantes pour se prononcer. */
  score: number | null;
  /** 0-1 : part des signaux disponibles chez les deux personnes. */
  coverage: number;
  /** Faits verifies qui ont pousse le score vers le haut. */
  positives: string[];
  /** Ecarts constates. */
  gaps: string[];
}

export interface MatchResult {
  /** 0-100, deja plafonne a productRules.maxDisplayedCompatibility. */
  score: number;
  dimensions: Record<DimensionKey, DimensionResult>;
  /** Poids effectivement appliques apres adaptation et renormalisation. */
  weights: Record<DimensionKey, number>;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  /** True si un critere essentiel de l'un des deux est viole (§22). */
  blocked: boolean;
  blockedReasons: string[];
}
