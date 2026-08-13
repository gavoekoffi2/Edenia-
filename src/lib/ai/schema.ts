import {
  ATTENDANCE,
  BIBLE_READING,
  COMMITMENT_LEVEL,
  DENOMINATION,
  EDUCATION,
  EXPATRIATION,
  EXTENDED_SUPPORT,
  FINANCE_MODEL,
  MARITAL_STATUS,
  RESIDENCE_AFTER,
  TIMELINE,
  TRI_STATE,
  WANTS_MARRIAGE,
} from "@/lib/config/enums";

/**
 * Registre des champs que EDENIA AI a le droit d'extraire d'une conversation.
 *
 * C'est un **contrat ferme** : l'IA ne peut rien remplir en dehors de cette liste.
 * Chaque champ porte son seuil de confiance et son obligation de confirmation,
 * ce qui traduit le §13 (« l'IA ne doit jamais inventer ») en regle executable
 * plutot qu'en intention.
 */

export const TOPICS = [
  "IDENTITY",
  "LOCATION",
  "WORK",
  "FAITH",
  "MARRIAGE",
  "FAMILY",
  "LIFESTYLE",
  "EXPECTATIONS",
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABEL: Record<Topic, string> = {
  IDENTITY: "Qui tu es",
  LOCATION: "Où tu vis",
  WORK: "Ce que tu fais",
  FAITH: "Ta foi",
  MARRIAGE: "Ta vision du mariage",
  FAMILY: "Ta famille et ton futur foyer",
  LIFESTYLE: "Ton quotidien",
  EXPECTATIONS: "Ce que tu recherches",
};

export type FieldType = "string" | "number" | "boolean" | "enum" | "string[]";

export interface FieldSpec {
  /** Cle stable, forme `modele.champ`. */
  key: string;
  model:
    | "Profile"
    | "FaithProfile"
    | "MarriageVision"
    | "FamilyPreferences"
    | "Lifestyle"
    | "Preferences";
  field: string;
  labelFr: string;
  type: FieldType;
  enumValues?: readonly string[];
  topic: Topic;
  /**
   * ESSENTIAL : sans lui, pas de profil publiable.
   * IMPORTANT : pese fortement dans le matching.
   * NICE      : enrichit le profil.
   */
  importance: "ESSENTIAL" | "IMPORTANT" | "NICE";
  /**
   * §13 : « Pour les informations importantes, l'IA doit demander confirmation. »
   * Un champ ainsi marque n'est jamais applique sans un oui explicite.
   */
  requireConfirmation: boolean;
  /** En dessous, l'extraction passe en NEEDS_CONFIRMATION quoi qu'il arrive. */
  minConfidence: number;
  min?: number;
  max?: number;
}

export const FIELD_SPECS: readonly FieldSpec[] = [
  // --- Identite ------------------------------------------------------------
  {
    key: "Profile.firstName",
    model: "Profile",
    field: "firstName",
    labelFr: "Prénom",
    type: "string",
    topic: "IDENTITY",
    importance: "ESSENTIAL",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "Profile.age",
    model: "Profile",
    field: "age",
    labelFr: "Âge",
    type: "number",
    topic: "IDENTITY",
    importance: "ESSENTIAL",
    requireConfirmation: true,
    minConfidence: 0.8,
    min: 18,
    max: 99,
  },
  {
    key: "Profile.maritalStatus",
    model: "Profile",
    field: "maritalStatus",
    labelFr: "Situation familiale",
    type: "enum",
    enumValues: MARITAL_STATUS,
    topic: "IDENTITY",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "Profile.hasChildren",
    model: "Profile",
    field: "hasChildren",
    labelFr: "A des enfants",
    type: "boolean",
    topic: "IDENTITY",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.8,
  },

  // --- Localisation --------------------------------------------------------
  {
    key: "Profile.cityLabel",
    model: "Profile",
    field: "cityLabel",
    labelFr: "Ville",
    type: "string",
    topic: "LOCATION",
    importance: "ESSENTIAL",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "Profile.countryCode",
    model: "Profile",
    field: "countryCode",
    labelFr: "Pays",
    type: "string",
    topic: "LOCATION",
    importance: "ESSENTIAL",
    requireConfirmation: false,
    minConfidence: 0.75,
  },

  // --- Travail -------------------------------------------------------------
  {
    key: "Profile.profession",
    model: "Profile",
    field: "profession",
    labelFr: "Profession",
    type: "string",
    topic: "WORK",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.6,
  },
  {
    key: "Profile.education",
    model: "Profile",
    field: "education",
    labelFr: "Niveau d'études",
    type: "enum",
    enumValues: EDUCATION,
    topic: "WORK",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.7,
  },

  // --- Foi (§17) — donnee sensible, confirmation systematique (cf. C6) ------
  {
    key: "FaithProfile.denomination",
    model: "FaithProfile",
    field: "denomination",
    labelFr: "Dénomination",
    type: "enum",
    enumValues: DENOMINATION,
    topic: "FAITH",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.75,
  },
  {
    key: "FaithProfile.commitmentLevel",
    model: "FaithProfile",
    field: "commitmentLevel",
    labelFr: "Engagement dans l'Église",
    type: "enum",
    enumValues: COMMITMENT_LEVEL,
    topic: "FAITH",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "FaithProfile.attendance",
    model: "FaithProfile",
    field: "attendance",
    labelFr: "Fréquence de participation",
    type: "enum",
    enumValues: ATTENDANCE,
    topic: "FAITH",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.7,
  },
  {
    key: "FaithProfile.prayerImportance",
    model: "FaithProfile",
    field: "prayerImportance",
    labelFr: "Importance de la prière",
    type: "number",
    topic: "FAITH",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.65,
    min: 1,
    max: 5,
  },
  {
    key: "FaithProfile.bibleReading",
    model: "FaithProfile",
    field: "bibleReading",
    labelFr: "Lecture biblique",
    type: "enum",
    enumValues: BIBLE_READING,
    topic: "FAITH",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.65,
  },
  {
    key: "FaithProfile.churchNameRaw",
    model: "FaithProfile",
    field: "churchNameRaw",
    labelFr: "Église",
    type: "string",
    topic: "FAITH",
    importance: "NICE",
    requireConfirmation: true,
    minConfidence: 0.75,
  },
  {
    key: "FaithProfile.faithInCouple",
    model: "FaithProfile",
    field: "faithInCouple",
    labelFr: "Place de la foi dans le couple",
    type: "string",
    topic: "FAITH",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.6,
  },

  // --- Mariage (§18) -------------------------------------------------------
  {
    key: "MarriageVision.wantsMarriage",
    model: "MarriageVision",
    field: "wantsMarriage",
    labelFr: "Désir de mariage",
    type: "enum",
    enumValues: WANTS_MARRIAGE,
    topic: "MARRIAGE",
    importance: "ESSENTIAL",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "MarriageVision.timeline",
    model: "MarriageVision",
    field: "timeline",
    labelFr: "Horizon de temps",
    type: "enum",
    enumValues: TIMELINE,
    topic: "MARRIAGE",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.65,
  },
  {
    key: "MarriageVision.wantsChildren",
    model: "MarriageVision",
    field: "wantsChildren",
    labelFr: "Désir d'enfants",
    type: "enum",
    enumValues: TRI_STATE,
    topic: "MARRIAGE",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.7,
  },
  {
    key: "MarriageVision.childrenDesired",
    model: "MarriageVision",
    field: "childrenDesired",
    labelFr: "Nombre d'enfants souhaité",
    type: "number",
    topic: "MARRIAGE",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.7,
    min: 0,
    max: 12,
  },
  {
    key: "MarriageVision.financeModel",
    model: "MarriageVision",
    field: "financeModel",
    labelFr: "Gestion des finances",
    type: "enum",
    enumValues: FINANCE_MODEL,
    topic: "MARRIAGE",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.65,
  },
  {
    key: "MarriageVision.residenceAfter",
    model: "MarriageVision",
    field: "residenceAfter",
    labelFr: "Lieu de vie après le mariage",
    type: "enum",
    enumValues: RESIDENCE_AFTER,
    topic: "MARRIAGE",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.65,
  },
  {
    key: "MarriageVision.expatriation",
    model: "MarriageVision",
    field: "expatriation",
    labelFr: "Expatriation",
    type: "enum",
    enumValues: EXPATRIATION,
    topic: "MARRIAGE",
    importance: "IMPORTANT",
    requireConfirmation: true,
    minConfidence: 0.7,
  },

  // --- Famille (§19) -------------------------------------------------------
  {
    key: "FamilyPreferences.extendedFamilySupport",
    model: "FamilyPreferences",
    field: "extendedFamilySupport",
    labelFr: "Soutien à la famille élargie",
    type: "enum",
    enumValues: EXTENDED_SUPPORT,
    topic: "FAMILY",
    importance: "IMPORTANT",
    requireConfirmation: false,
    minConfidence: 0.65,
  },
  {
    key: "FamilyPreferences.traditionsImportance",
    model: "FamilyPreferences",
    field: "traditionsImportance",
    labelFr: "Importance des traditions",
    type: "number",
    topic: "FAMILY",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.6,
    min: 1,
    max: 5,
  },

  // --- Quotidien -----------------------------------------------------------
  {
    key: "Lifestyle.interests",
    model: "Lifestyle",
    field: "interests",
    labelFr: "Centres d'intérêt",
    type: "string[]",
    topic: "LIFESTYLE",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.55,
  },
  {
    key: "Lifestyle.socialStyle",
    model: "Lifestyle",
    field: "socialStyle",
    labelFr: "Rythme social",
    type: "enum",
    enumValues: ["HOMEBODY", "BALANCED", "OUTGOING"],
    topic: "LIFESTYLE",
    importance: "NICE",
    requireConfirmation: false,
    minConfidence: 0.6,
  },
] as const;

const SPEC_BY_KEY = new Map(FIELD_SPECS.map((spec) => [spec.key, spec]));

export function getFieldSpec(key: string): FieldSpec | undefined {
  return SPEC_BY_KEY.get(key);
}

export function fieldsForTopic(topic: Topic): FieldSpec[] {
  return FIELD_SPECS.filter((spec) => spec.topic === topic);
}

/** §61 : liste minimale requise avant d'acceder a la decouverte. */
export const ESSENTIAL_KEYS = FIELD_SPECS.filter((s) => s.importance === "ESSENTIAL").map((s) => s.key);
