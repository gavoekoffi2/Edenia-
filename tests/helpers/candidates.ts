import type { Candidate } from "@/lib/matching/types";

/** Base neutre : profil complet, valeurs medianes. Chaque test ne surcharge que ce qui l'interesse. */
export function makeCandidate(overrides: DeepPartial<Candidate> = {}): Candidate {
  const base: Candidate = {
    core: {
      userId: "u-" + Math.random().toString(36).slice(2, 8),
      gender: "M",
      seeking: "F",
      age: 31,
      maritalStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      education: "BACHELOR",
      isVerifiedContact: true,
      hasVerifiedIdentity: false,
      hasVerifiedProfile: false,
      hasVerifiedChurch: false,
      ageOfAccountDays: 30,
      lastActiveDaysAgo: 1,
    },
    faith: {
      denomination: "EVANGELICAL",
      commitmentLevel: "COMMITTED",
      attendance: "WEEKLY",
      prayerImportance: 4,
      bibleReading: "WEEKLY",
      faithInCouple: "Prier ensemble et servir dans notre eglise",
    },
    marriage: {
      wantsMarriage: "YES",
      timeline: "WITHIN_2Y",
      wantsChildren: "YES",
      childrenDesired: 3,
      financeModel: "POOLED",
      careerView: "FLEXIBLE",
      residenceAfter: "OWN_HOME",
      expatriation: "PREFER_STAY",
      countryAfter: "TG",
    },
    family: {
      familyProximity: "SAME_CITY",
      extendedFamilySupport: "IMPORTANT",
      traditionsImportance: 3,
      inLawsRole: "CONSULTED",
      dowryView: "TRADITIONAL",
    },
    personality: {
      openness: 60,
      conscientiousness: 70,
      extraversion: 50,
      agreeableness: 65,
      emotionality: 55,
      conflictStyle: "DIALOGUE",
    },
    lifestyle: {
      interests: ["musique", "lecture", "football"],
      smoking: "NEVER",
      alcohol: "NEVER",
      socialStyle: "BALANCED",
    },
    location: {
      countryCode: "TG",
      regionId: "tg-maritime",
      cityId: "tg-lome",
      cityLat: 6.1319,
      cityLng: 1.2228,
      isDiaspora: false,
    },
    preferences: {
      ageMin: 21,
      ageMax: 45,
      scope: "CITY",
      distanceKm: null,
      countries: [],
      denominations: [],
      openToDiaspora: true,
      openToChildren: true,
      educationMin: null,
    },
    dealbreakers: [],
    visibility: {},
  };

  return merge(base, overrides) as Candidate;
}

export function makePair(
  a: DeepPartial<Candidate> = {},
  b: DeepPartial<Candidate> = {},
): [Candidate, Candidate] {
  return [
    makeCandidate({ core: { gender: "M", seeking: "F" }, ...a }),
    makeCandidate({ core: { gender: "F", seeking: "M" }, ...b }),
  ];
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = merge(current, value as never);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}
