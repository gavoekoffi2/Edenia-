import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ageFromBirthDate, parseJsonArray } from "@/lib/db/serialize";
import type { Candidate } from "./types";

/**
 * Pont entre la base et le moteur de matching. Le moteur reste pur ; c'est ici
 * — et uniquement ici — que l'on connait Prisma.
 */

export const candidateInclude = {
  profile: { include: { city: true, region: true, country: true } },
  faithProfile: true,
  marriageVision: true,
  familyPreferences: true,
  personalityProfile: true,
  lifestyle: true,
  preferences: true,
  dealbreakers: true,
  identityVerification: true,
  profileVerification: true,
  churchVerification: true,
} satisfies Prisma.UserInclude;

export type CandidateRow = Prisma.UserGetPayload<{ include: typeof candidateInclude }>;

function parseVisibility(raw: string | null | undefined): Record<string, "PUBLIC" | "MATCHES" | "PRIVATE"> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, "PUBLIC" | "MATCHES" | "PRIVATE">;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function toCandidate(row: CandidateRow, now = new Date()): Candidate | null {
  const profile = row.profile;
  if (!profile) return null;

  const preferences = row.preferences;

  return {
    core: {
      userId: row.id,
      gender: profile.gender === "F" ? "F" : "M",
      seeking: profile.seeking === "F" ? "F" : "M",
      age: ageFromBirthDate(profile.birthDate, now),
      maritalStatus: profile.maritalStatus as Candidate["core"]["maritalStatus"],
      hasChildren: profile.hasChildren,
      childrenCount: profile.childrenCount,
      education: (profile.education as Candidate["core"]["education"]) ?? null,
      isVerifiedContact: row.phoneVerified || row.emailVerified,
      hasVerifiedIdentity: row.identityVerification?.status === "APPROVED",
      hasVerifiedProfile: row.profileVerification?.status === "APPROVED",
      hasVerifiedChurch: row.churchVerification?.status === "APPROVED",
      ageOfAccountDays: Math.floor((now.getTime() - row.createdAt.getTime()) / 86_400_000),
      lastActiveDaysAgo: Math.floor((now.getTime() - row.lastActiveAt.getTime()) / 86_400_000),
    },
    faith: {
      denomination: (row.faithProfile?.denomination as Candidate["faith"]["denomination"]) ?? null,
      commitmentLevel: (row.faithProfile?.commitmentLevel as Candidate["faith"]["commitmentLevel"]) ?? null,
      attendance: (row.faithProfile?.attendance as Candidate["faith"]["attendance"]) ?? null,
      prayerImportance: row.faithProfile?.prayerImportance ?? null,
      bibleReading: (row.faithProfile?.bibleReading as Candidate["faith"]["bibleReading"]) ?? null,
      faithInCouple: row.faithProfile?.faithInCouple ?? null,
    },
    marriage: {
      wantsMarriage: (row.marriageVision?.wantsMarriage as Candidate["marriage"]["wantsMarriage"]) ?? null,
      timeline: (row.marriageVision?.timeline as Candidate["marriage"]["timeline"]) ?? null,
      wantsChildren: (row.marriageVision?.wantsChildren as Candidate["marriage"]["wantsChildren"]) ?? null,
      childrenDesired: row.marriageVision?.childrenDesired ?? null,
      financeModel: (row.marriageVision?.financeModel as Candidate["marriage"]["financeModel"]) ?? null,
      careerView: (row.marriageVision?.careerView as Candidate["marriage"]["careerView"]) ?? null,
      residenceAfter: (row.marriageVision?.residenceAfter as Candidate["marriage"]["residenceAfter"]) ?? null,
      expatriation: (row.marriageVision?.expatriation as Candidate["marriage"]["expatriation"]) ?? null,
      countryAfter: row.marriageVision?.countryAfter ?? null,
    },
    family: {
      familyProximity: row.familyPreferences?.familyProximity ?? null,
      extendedFamilySupport:
        (row.familyPreferences?.extendedFamilySupport as Candidate["family"]["extendedFamilySupport"]) ?? null,
      traditionsImportance: row.familyPreferences?.traditionsImportance ?? null,
      inLawsRole: row.familyPreferences?.inLawsRole ?? null,
      dowryView: row.familyPreferences?.dowryView ?? null,
    },
    personality: {
      openness: row.personalityProfile?.openness ?? null,
      conscientiousness: row.personalityProfile?.conscientiousness ?? null,
      extraversion: row.personalityProfile?.extraversion ?? null,
      agreeableness: row.personalityProfile?.agreeableness ?? null,
      emotionality: row.personalityProfile?.emotionality ?? null,
      conflictStyle: row.personalityProfile?.conflictStyle ?? null,
    },
    lifestyle: {
      interests: parseJsonArray(row.lifestyle?.interests),
      smoking: row.lifestyle?.smoking ?? null,
      alcohol: row.lifestyle?.alcohol ?? null,
      socialStyle: row.lifestyle?.socialStyle ?? null,
    },
    location: {
      countryCode: profile.countryCode,
      regionId: profile.regionId,
      cityId: profile.cityId,
      cityLat: profile.city?.lat ?? null,
      cityLng: profile.city?.lng ?? null,
      isDiaspora: profile.isDiaspora,
    },
    preferences: {
      ageMin: preferences?.ageMin ?? 18,
      ageMax: preferences?.ageMax ?? 99,
      scope: (preferences?.scope as Candidate["preferences"]["scope"]) ?? "COUNTRY",
      distanceKm: preferences?.distanceKm ?? null,
      countries: parseJsonArray(preferences?.countriesJson),
      denominations: parseJsonArray(preferences?.denominationsJson) as Candidate["preferences"]["denominations"],
      openToDiaspora: preferences?.openToDiaspora ?? true,
      openToChildren: preferences?.openToChildren ?? true,
      educationMin: (preferences?.educationMin as Candidate["preferences"]["educationMin"]) ?? null,
    },
    dealbreakers: (row.dealbreakers ?? []).map((rule) => ({
      key: rule.key,
      operator: rule.operator,
      value: safeParse(rule.valueJson),
    })),
    visibility: {
      ...parseVisibility(row.faithProfile?.visibility),
      ...parseVisibility(row.marriageVision?.visibility),
    },
  };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function loadCandidate(userId: string): Promise<Candidate | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, include: candidateInclude });
  return row ? toCandidate(row) : null;
}
