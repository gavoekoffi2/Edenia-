/**
 * Valeurs enumerees du domaine EDENIA.
 *
 * Le schema Prisma est volontairement portable (String au lieu d'enum, cf.
 * docs/01-architecture.md §4). La verite des valeurs autorisees vit donc ici,
 * et est appliquee par Zod a chaque frontiere reseau.
 */

export const USER_STATUS = ["ACTIVE", "RESTRICTED", "SUSPENDED", "BANNED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const GENDER = ["F", "M"] as const;
export type Gender = (typeof GENDER)[number];

export const MARITAL_STATUS = ["SINGLE", "SEPARATED", "DIVORCED", "WIDOWED"] as const;
export type MaritalStatus = (typeof MARITAL_STATUS)[number];

export const EDUCATION = [
  "NONE",
  "SECONDARY",
  "VOCATIONAL",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
] as const;
export type Education = (typeof EDUCATION)[number];

/** Ordre croissant, utilise pour l'operateur AT_LEAST des criteres essentiels. */
export const EDUCATION_RANK: Record<Education, number> = {
  NONE: 0,
  SECONDARY: 1,
  VOCATIONAL: 2,
  BACHELOR: 3,
  MASTER: 4,
  DOCTORATE: 5,
};

// --- Foi (§17) -------------------------------------------------------------

export const DENOMINATION = [
  "CATHOLIC",
  "PROTESTANT",
  "EVANGELICAL",
  "PENTECOSTAL",
  "METHODIST",
  "BAPTIST",
  "ADVENTIST",
  "ORTHODOX",
  "OTHER",
  "PREFER_NOT_SAY",
] as const;
export type Denomination = (typeof DENOMINATION)[number];

export const DENOMINATION_LABEL: Record<Denomination, string> = {
  CATHOLIC: "Catholique",
  PROTESTANT: "Protestante",
  EVANGELICAL: "Évangélique",
  PENTECOSTAL: "Pentecôtiste",
  METHODIST: "Méthodiste",
  BAPTIST: "Baptiste",
  ADVENTIST: "Adventiste",
  ORTHODOX: "Orthodoxe",
  OTHER: "Autre",
  PREFER_NOT_SAY: "Je préfère ne pas préciser",
};

export const COMMITMENT_LEVEL = ["OCCASIONAL", "REGULAR", "COMMITTED", "SERVING"] as const;
export type CommitmentLevel = (typeof COMMITMENT_LEVEL)[number];
export const COMMITMENT_RANK: Record<CommitmentLevel, number> = {
  OCCASIONAL: 1,
  REGULAR: 2,
  COMMITTED: 3,
  SERVING: 4,
};

export const ATTENDANCE = ["RARELY", "MONTHLY", "WEEKLY", "MULTIPLE_WEEKLY"] as const;
export type Attendance = (typeof ATTENDANCE)[number];
export const ATTENDANCE_RANK: Record<Attendance, number> = {
  RARELY: 1,
  MONTHLY: 2,
  WEEKLY: 3,
  MULTIPLE_WEEKLY: 4,
};

export const BIBLE_READING = ["RARELY", "SOMETIMES", "WEEKLY", "DAILY"] as const;
export type BibleReading = (typeof BIBLE_READING)[number];
export const BIBLE_READING_RANK: Record<BibleReading, number> = {
  RARELY: 1,
  SOMETIMES: 2,
  WEEKLY: 3,
  DAILY: 4,
};

// --- Vision du mariage (§18) ----------------------------------------------

/**
 * §13 — « L'IA ne doit jamais inventer ».
 * UNDECIDED est une valeur de premiere classe : « à discuter » est une reponse
 * valide, pas une absence de reponse.
 */
export const TRI_STATE = ["YES", "NO", "UNDECIDED"] as const;
export type TriState = (typeof TRI_STATE)[number];

export const WANTS_MARRIAGE = ["YES", "PROBABLY", "UNDECIDED"] as const;
export type WantsMarriage = (typeof WANTS_MARRIAGE)[number];

export const TIMELINE = ["WITHIN_1Y", "WITHIN_2Y", "WITHIN_5Y", "NO_RUSH", "UNDECIDED"] as const;
export type Timeline = (typeof TIMELINE)[number];
export const TIMELINE_MONTHS: Record<Timeline, number | null> = {
  WITHIN_1Y: 12,
  WITHIN_2Y: 24,
  WITHIN_5Y: 60,
  NO_RUSH: 120,
  UNDECIDED: null,
};

export const FINANCE_MODEL = ["POOLED", "SEPARATE", "MIXED", "UNDECIDED"] as const;
export type FinanceModel = (typeof FINANCE_MODEL)[number];

export const CAREER_VIEW = ["BOTH_CAREERS", "ONE_FOCUS_HOME", "FLEXIBLE", "UNDECIDED"] as const;
export type CareerView = (typeof CAREER_VIEW)[number];

export const RESIDENCE_AFTER = ["OWN_HOME", "WITH_FAMILY", "UNDECIDED"] as const;
export type ResidenceAfter = (typeof RESIDENCE_AFTER)[number];

export const EXPATRIATION = ["WANTED", "OPEN", "PREFER_STAY", "REFUSED", "UNDECIDED"] as const;
export type Expatriation = (typeof EXPATRIATION)[number];
/** Axe continu de 0 (rester) a 1 (partir) — UNDECIDED reste hors axe. */
export const EXPATRIATION_AXIS: Record<Expatriation, number | null> = {
  WANTED: 1,
  OPEN: 0.66,
  PREFER_STAY: 0.33,
  REFUSED: 0,
  UNDECIDED: null,
};

export const LIFE_IN_AFRICA = ["COMMITTED", "OPEN", "UNSURE"] as const;
export type LifeInAfrica = (typeof LIFE_IN_AFRICA)[number];

// --- Famille (§19) ---------------------------------------------------------

export const PARENTS_RELATIONSHIP = ["CLOSE", "REGULAR", "DISTANT", "COMPLEX"] as const;
export const FAMILY_PROXIMITY = ["SAME_CITY", "SAME_COUNTRY", "FLEXIBLE", "FAR"] as const;
export const EXTENDED_SUPPORT = [
  "ESSENTIAL",
  "IMPORTANT",
  "OCCASIONAL",
  "LIMITED",
  "UNDECIDED",
] as const;
export type ExtendedSupport = (typeof EXTENDED_SUPPORT)[number];
/** §19 : « Ne pas imposer une vision unique » — c'est un axe, pas une echelle de valeur. */
export const EXTENDED_SUPPORT_AXIS: Record<ExtendedSupport, number | null> = {
  ESSENTIAL: 1,
  IMPORTANT: 0.75,
  OCCASIONAL: 0.5,
  LIMITED: 0.25,
  UNDECIDED: null,
};

export const IN_LAWS_ROLE = ["INVOLVED", "CONSULTED", "RESPECTFUL_DISTANCE", "UNDECIDED"] as const;
export const DOWRY_VIEW = ["TRADITIONAL", "SYMBOLIC", "MINIMAL", "UNDECIDED"] as const;

// --- Preferences et decouverte --------------------------------------------

export const SCOPE = [
  "CITY",
  "REGION",
  "COUNTRY",
  "FRANCOPHONE_AFRICA",
  "INTERNATIONAL",
  "DIASPORA",
] as const;
export type Scope = (typeof SCOPE)[number];

export const DISCOVERY_RAIL = [
  "for-you",
  "near-you",
  "verified",
  "high-compatibility",
  "new",
  "diaspora",
] as const;
export type DiscoveryRail = (typeof DISCOVERY_RAIL)[number];

export const RAIL_LABEL: Record<DiscoveryRail, { emoji: string; title: string; subtitle: string }> = {
  "for-you": {
    emoji: "❤️",
    title: "Pour toi",
    subtitle: "Des personnes choisies selon ta foi, tes valeurs et ton projet",
  },
  "near-you": { emoji: "📍", title: "Près de toi", subtitle: "Dans ta ville et ta région" },
  verified: {
    emoji: "🛡️",
    title: "Profils vérifiés",
    subtitle: "Des profils contrôlés par l'équipe EDENIA",
  },
  "high-compatibility": {
    emoji: "✨",
    title: "Compatibilité élevée",
    subtitle: "Les affinités les plus fortes avec ton profil",
  },
  new: { emoji: "🆕", title: "Nouveaux profils", subtitle: "Ils viennent de rejoindre EDENIA" },
  diaspora: {
    emoji: "🌍",
    title: "Diaspora",
    subtitle: "Vivant hors d'Afrique, ouverts à une rencontre africaine",
  },
};

// --- Criteres essentiels (§22) --------------------------------------------

export const DEALBREAKER_KEY = [
  "WANTS_MARRIAGE",
  "WANTS_CHILDREN",
  "FAITH_PRACTICE",
  "DENOMINATION",
  "COUNTRY",
  "CITY",
  "EXPATRIATION",
  "FAMILY_VISION",
  "NO_CHILDREN_ALREADY",
] as const;
export type DealbreakerKey = (typeof DEALBREAKER_KEY)[number];

export const DEALBREAKER_LABEL: Record<DealbreakerKey, string> = {
  WANTS_MARRIAGE: "Souhaite se marier",
  WANTS_CHILDREN: "Souhaite avoir des enfants",
  FAITH_PRACTICE: "Niveau de pratique chrétienne",
  DENOMINATION: "Dénomination",
  COUNTRY: "Pays de résidence",
  CITY: "Ville de résidence",
  EXPATRIATION: "Vision de l'expatriation",
  FAMILY_VISION: "Place de la famille élargie",
  NO_CHILDREN_ALREADY: "Sans enfant à ce jour",
};

export const DEALBREAKER_OPERATOR = ["EQUALS", "IN", "AT_LEAST", "AT_MOST", "NOT_EQUALS"] as const;
export type DealbreakerOperator = (typeof DEALBREAKER_OPERATOR)[number];

// --- Verification (§26) ----------------------------------------------------

export const VERIFICATION_KIND = ["IDENTITY", "PROFILE", "CHURCH"] as const;
export type VerificationKind = (typeof VERIFICATION_KIND)[number];

export const VERIFICATION_STATUS = [
  "PENDING",
  "IN_REVIEW",
  "NEED_MORE_INFO",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  /** §29 : une verification a une duree de validite. Voir EXPIRY_MONTHS. */
  "EXPIRED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

/**
 * Vocabulaire produit — ce que voient l'equipe et les membres.
 *
 * Les codes stockes ne sont pas renommes : `APPROVED` et `IN_REVIEW` sont
 * ecrits dans des milliers de lignes potentielles, dans le seed, et dans les
 * bases deja creees. Renommer une valeur persistee a la veille d'une beta pour
 * un gain purement lexical serait un mauvais echange. La traduction se fait
 * ici, en un seul endroit.
 */
export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: "En attente",
  IN_REVIEW: "En cours d'examen",
  NEED_MORE_INFO: "Complément demandé",
  APPROVED: "Vérifié",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
};

/** Statuts qui ouvrent un niveau de confiance. Un seul, volontairement. */
export const VERIFICATION_GRANTING: readonly VerificationStatus[] = ["APPROVED"];

// --- Moderation (§35) ------------------------------------------------------

export const REPORT_CATEGORY = [
  "SCAM_MONEY",
  "FAKE_PROFILE",
  "HARASSMENT",
  "INAPPROPRIATE",
  "UNDERAGE",
  "SPAM",
  "STOLEN_PHOTOS",
  "OTHER",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORY)[number];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  SCAM_MONEY: "Demande d'argent / arnaque",
  FAKE_PROFILE: "Faux profil",
  HARASSMENT: "Harcèlement",
  INAPPROPRIATE: "Contenu inapproprié",
  UNDERAGE: "Personne mineure",
  SPAM: "Spam",
  STOLEN_PHOTOS: "Photos volées",
  OTHER: "Autre",
};

/** §35 : Avertissement → Restriction → Suspension → Bannissement. */
export const SANCTION_LADDER = ["WARNING", "RESTRICTION", "SUSPENSION", "BAN"] as const;
export type Sanction = (typeof SANCTION_LADDER)[number];

// --- Paiement (§42) --------------------------------------------------------

export const PAYMENT_PROVIDER = [
  "TMONEY",
  "FLOOZ",
  "MTN_MOMO",
  "MOOV_MONEY",
  "ORANGE_MONEY",
  "WAVE",
  "CARD",
  "SIMULATED",
] as const;
export type PaymentProviderCode = (typeof PAYMENT_PROVIDER)[number];

export const PAYMENT_PROVIDER_LABEL: Record<PaymentProviderCode, string> = {
  TMONEY: "T-Money",
  FLOOZ: "Flooz",
  MTN_MOMO: "MTN Mobile Money",
  MOOV_MONEY: "Moov Money",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  CARD: "Carte bancaire",
  SIMULATED: "Paiement de démonstration",
};

// --- Visibilite des champs (§47, cf. C5/C6) --------------------------------

export const VISIBILITY = ["PUBLIC", "MATCHES", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITY)[number];
