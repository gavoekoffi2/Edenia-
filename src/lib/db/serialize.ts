import type { Visibility } from "@/lib/config/enums";
import { DENOMINATION_LABEL, type Denomination } from "@/lib/config/enums";

/**
 * Frontiere unique entre la base et le client (§47, §60, C3).
 *
 * Tout ce qui part vers un navigateur passe par ici. Concentrer la regle en un
 * seul endroit rend la fuite de donnees testable : `PRIVATE_KEYS` liste ce qui
 * ne doit jamais franchir la frontiere, et `assertNoPrivateLeak` echoue si un
 * champ interdit apparait dans une reponse (tests/privacy.test.ts).
 */

/** Champs qui ne doivent JAMAIS etre serialises vers un client. */
export const PRIVATE_KEYS = [
  "trustScore", // §34 : score interne, reserve a la moderation
  "phone",
  "email",
  "birthDate", // seul l'age derive est public
  "codeHash",
  "salt",
  "sessionVersion",
  "mfaSecretEnc",
  "documentKeyEnc",
  "selfieKeyEnc",
  "trustedContact",
  "ipHash",
  "fingerprint",
  "notesInternal",
  "rawPayload",
  "statusReason",
  "actorRef",
] as const;

export interface PublicBadges {
  /** §26 : niveaux factuels, jamais un jugement sur la personne. */
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  profileVerified: boolean;
  churchVerified: boolean;
  /** §30 : vrai des qu'au moins une verification humaine a abouti. */
  hasEdeniaBadge: boolean;
}

export interface PublicPhoto {
  id: string;
  url: string;
  blurhash: string | null;
  isPrimary: boolean;
}

export interface PublicProfile {
  userId: string;
  firstName: string;
  age: number;
  gender: string;
  /** §24 : granularite ville, jamais d'adresse ni de coordonnees. */
  cityLabel: string | null;
  regionLabel: string | null;
  countryLabel: string | null;
  isDiaspora: boolean;
  profession: string | null;
  education: string | null;
  maritalStatus: string;
  hasChildren: boolean;
  bio: string | null;
  interests: string[];
  photos: PublicPhoto[];
  badges: PublicBadges;
  /** Sections dont la visibilite autorise l'affichage pour ce spectateur. */
  faith: PublicFaith | null;
  marriage: PublicMarriage | null;
  /** Activite arrondie : « actif cette semaine », jamais un horodatage precis. */
  activityLabel: string;
}

export interface PublicFaith {
  denomination: string | null;
  commitmentLabel: string | null;
  attendanceLabel: string | null;
  churchName: string | null;
  faithInCouple: string | null;
}

export interface PublicMarriage {
  wantsMarriageLabel: string | null;
  timelineLabel: string | null;
  wantsChildrenLabel: string | null;
  residenceLabel: string | null;
}

const COMMITMENT_LABEL: Record<string, string> = {
  OCCASIONAL: "Présence occasionnelle",
  REGULAR: "Présence régulière",
  COMMITTED: "Engagé(e) dans son église",
  SERVING: "Sert dans son église",
};

const ATTENDANCE_LABEL: Record<string, string> = {
  RARELY: "Rarement",
  MONTHLY: "Une fois par mois",
  WEEKLY: "Chaque semaine",
  MULTIPLE_WEEKLY: "Plusieurs fois par semaine",
};

const WANTS_MARRIAGE_LABEL: Record<string, string> = {
  YES: "Souhaite se marier",
  PROBABLY: "S'oriente vers le mariage",
  UNDECIDED: "À discuter",
};

const TIMELINE_LABEL: Record<string, string> = {
  WITHIN_1Y: "Dans l'année",
  WITHIN_2Y: "D'ici deux ans",
  WITHIN_5Y: "D'ici cinq ans",
  NO_RUSH: "Sans précipitation",
  UNDECIDED: "À discuter",
};

const CHILDREN_LABEL: Record<string, string> = {
  YES: "Souhaite des enfants",
  NO: "Ne souhaite pas d'enfants",
  UNDECIDED: "À discuter",
};

const RESIDENCE_LABEL: Record<string, string> = {
  OWN_HOME: "Un foyer indépendant",
  WITH_FAMILY: "Proche de la famille",
  UNDECIDED: "À discuter",
};

export function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/** §47 : l'activite est arrondie pour ne pas devenir un traceur de presence. */
export function activityLabel(lastActiveAt: Date, now = new Date()): string {
  const hours = (now.getTime() - lastActiveAt.getTime()) / 3_600_000;
  if (hours < 24) return "Actif(ve) aujourd'hui";
  if (hours < 24 * 7) return "Actif(ve) cette semaine";
  if (hours < 24 * 30) return "Actif(ve) ce mois-ci";
  return "Moins actif(ve) récemment";
}

function parseVisibility(raw: string | null | undefined): Record<string, Visibility> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Visibility>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Le spectateur peut-il voir cette section ? */
function visible(map: Record<string, Visibility>, section: string, isMatched: boolean): boolean {
  const level = map[section] ?? "PUBLIC";
  if (level === "PUBLIC") return true;
  if (level === "MATCHES") return isMatched;
  return false;
}

/** Forme laxiste : accepte le resultat d'un `include` Prisma sans le typer en dur. */
export interface SerializableUser {
  id: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  lastActiveAt: Date;
  profile: {
    firstName: string;
    birthDate: Date;
    gender: string;
    profession: string | null;
    education: string | null;
    maritalStatus: string;
    hasChildren: boolean;
    bio: string | null;
    isDiaspora: boolean;
    city?: { nameFr: string } | null;
    region?: { nameFr: string } | null;
    country?: { nameFr: string } | null;
  } | null;
  photos?: Array<{ id: string; storageKey: string; blurhash: string | null; isPrimary: boolean; moderationStatus: string }>;
  lifestyle?: { interests: string } | null;
  faithProfile?: {
    denomination: string | null;
    commitmentLevel: string | null;
    attendance: string | null;
    churchNameRaw: string | null;
    faithInCouple: string | null;
    visibility: string;
    church?: { name: string } | null;
  } | null;
  marriageVision?: {
    wantsMarriage: string | null;
    timeline: string | null;
    wantsChildren: string | null;
    residenceAfter: string | null;
    visibility: string;
  } | null;
  identityVerification?: { status: string } | null;
  profileVerification?: { status: string } | null;
  churchVerification?: { status: string } | null;
}

export interface SerializeOptions {
  /** True si le spectateur et la personne ont matche (§32). */
  isMatched?: boolean;
  now?: Date;
}

export function toPublicProfile(user: SerializableUser, options: SerializeOptions = {}): PublicProfile | null {
  const { isMatched = false, now = new Date() } = options;
  const profile = user.profile;
  if (!profile) return null;

  const identityVerified = user.identityVerification?.status === "APPROVED";
  const profileVerified = user.profileVerification?.status === "APPROVED";
  const churchVerified = user.churchVerification?.status === "APPROVED";

  const faithVisibility = parseVisibility(user.faithProfile?.visibility);
  const marriageVisibility = parseVisibility(user.marriageVision?.visibility);

  const faith: PublicFaith | null =
    user.faithProfile && visible(faithVisibility, "faith", isMatched)
      ? {
          denomination:
            user.faithProfile.denomination && user.faithProfile.denomination !== "PREFER_NOT_SAY"
              ? (DENOMINATION_LABEL[user.faithProfile.denomination as Denomination] ?? null)
              : null,
          commitmentLabel: user.faithProfile.commitmentLevel
            ? (COMMITMENT_LABEL[user.faithProfile.commitmentLevel] ?? null)
            : null,
          attendanceLabel: user.faithProfile.attendance
            ? (ATTENDANCE_LABEL[user.faithProfile.attendance] ?? null)
            : null,
          churchName: user.faithProfile.church?.name ?? user.faithProfile.churchNameRaw ?? null,
          faithInCouple: user.faithProfile.faithInCouple,
        }
      : null;

  const marriage: PublicMarriage | null =
    user.marriageVision && visible(marriageVisibility, "marriage", isMatched)
      ? {
          wantsMarriageLabel: user.marriageVision.wantsMarriage
            ? (WANTS_MARRIAGE_LABEL[user.marriageVision.wantsMarriage] ?? null)
            : null,
          timelineLabel: user.marriageVision.timeline
            ? (TIMELINE_LABEL[user.marriageVision.timeline] ?? null)
            : null,
          wantsChildrenLabel: user.marriageVision.wantsChildren
            ? (CHILDREN_LABEL[user.marriageVision.wantsChildren] ?? null)
            : null,
          residenceLabel: user.marriageVision.residenceAfter
            ? (RESIDENCE_LABEL[user.marriageVision.residenceAfter] ?? null)
            : null,
        }
      : null;

  return {
    userId: user.id,
    firstName: profile.firstName,
    age: ageFromBirthDate(profile.birthDate, now),
    gender: profile.gender,
    cityLabel: profile.city?.nameFr ?? null,
    regionLabel: profile.region?.nameFr ?? null,
    countryLabel: profile.country?.nameFr ?? null,
    isDiaspora: profile.isDiaspora,
    profession: profile.profession,
    education: profile.education,
    maritalStatus: profile.maritalStatus,
    hasChildren: profile.hasChildren,
    bio: profile.bio,
    interests: parseJsonArray(user.lifestyle?.interests),
    photos: (user.photos ?? [])
      // Une photo non approuvee n'est jamais diffusee (§35, M4).
      .filter((photo) => photo.moderationStatus === "APPROVED")
      .map((photo) => ({
        id: photo.id,
        url: `/media/${photo.storageKey}`,
        blurhash: photo.blurhash,
        isPrimary: photo.isPrimary,
      })),
    badges: {
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      identityVerified,
      profileVerified,
      churchVerified,
      hasEdeniaBadge: identityVerified || profileVerified || churchVerified,
    },
    faith,
    marriage,
    activityLabel: activityLabel(user.lastActiveAt, now),
  };
}

/**
 * Garde-fou executable : parcourt une structure serialisee et signale tout champ
 * interdit. Utilise dans les tests, et disponible en developpement pour verifier
 * une nouvelle route avant sa mise en ligne.
 */
export function findPrivateLeaks(payload: unknown, path = "$"): string[] {
  const leaks: string[] = [];

  const walk = (node: unknown, currentPath: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${currentPath}[${index}]`));
      return;
    }
    if (typeof node !== "object") return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if ((PRIVATE_KEYS as readonly string[]).includes(key)) {
        leaks.push(`${currentPath}.${key}`);
      }
      walk(value, `${currentPath}.${key}`);
    }
  };

  walk(payload, path);
  return leaks;
}

export function assertNoPrivateLeak(payload: unknown): void {
  const leaks = findPrivateLeaks(payload);
  if (leaks.length > 0) {
    throw new Error(`Fuite de données privées détectée : ${leaks.join(", ")}`);
  }
}
