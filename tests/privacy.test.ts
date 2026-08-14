import { describe, expect, it } from "vitest";
import {
  PRIVATE_KEYS,
  activityLabel,
  ageFromBirthDate,
  assertNoPrivateLeak,
  findPrivateLeaks,
  toPublicProfile,
  type SerializableUser,
} from "@/lib/db/serialize";
import {
  CAPABILITIES,
  NEVER_PAYWALLED,
  dailyLikeLimit,
  hasCapability,
  railLimit,
} from "@/lib/premium/entitlements";
import { can, permissionsFor } from "@/lib/auth/rbac";
import { computeTrustScore, scanMessage, trustBand, trustEffects } from "@/lib/trust/signals";
import { isZeroTolerance, recommendSanction } from "@/lib/moderation/sanctions";
import { LEVELS, VERIFICATION_LEVELS, hasEdeniaBadge, validateDecision } from "@/lib/verification/levels";
import { productRules } from "@/lib/config/features";

function makeUser(overrides: Partial<SerializableUser> = {}): SerializableUser {
  return {
    id: "u1",
    phoneVerified: true,
    emailVerified: false,
    lastActiveAt: new Date(),
    profile: {
      firstName: "Ama",
      birthDate: new Date("1997-04-12"),
      gender: "F",
      profession: "Sage-femme",
      education: "BACHELOR",
      maritalStatus: "SINGLE",
      hasChildren: false,
      bio: "Une présentation.",
      isDiaspora: false,
      city: { nameFr: "Lomé" },
      region: { nameFr: "Maritime" },
      country: { nameFr: "Togo" },
    },
    photos: [
      { id: "p1", storageKey: "a.webp", blurhash: null, isPrimary: true, moderationStatus: "APPROVED" },
      { id: "p2", storageKey: "b.webp", blurhash: null, isPrimary: false, moderationStatus: "PENDING" },
    ],
    lifestyle: { interests: JSON.stringify(["lecture", "chorale"]) },
    faithProfile: {
      denomination: "EVANGELICAL",
      commitmentLevel: "SERVING",
      attendance: "WEEKLY",
      churchNameRaw: "Assemblées de Dieu",
      faithInCouple: "Prier ensemble",
      visibility: JSON.stringify({ faith: "PUBLIC" }),
      church: null,
    },
    marriageVision: {
      wantsMarriage: "YES",
      timeline: "WITHIN_2Y",
      wantsChildren: "UNDECIDED",
      residenceAfter: "OWN_HOME",
      visibility: JSON.stringify({ marriage: "PUBLIC" }),
    },
    identityVerification: { status: "APPROVED" },
    profileVerification: { status: "NONE" },
    churchVerification: { status: "NONE" },
    ...overrides,
  };
}

describe("frontière de confidentialité (§47, §60)", () => {
  it("ne laisse fuir aucun champ privé dans un profil public", () => {
    const profile = toPublicProfile(makeUser());
    expect(profile).not.toBeNull();
    expect(() => assertNoPrivateLeak(profile)).not.toThrow();
  });

  it("détecte une fuite si un champ interdit est ajouté par erreur", () => {
    const payload = { profile: toPublicProfile(makeUser()), trustScore: 42 };
    const leaks = findPrivateLeaks(payload);
    expect(leaks).toContain("$.trustScore");
  });

  it("détecte une fuite imbriquée dans un tableau", () => {
    const leaks = findPrivateLeaks({ results: [{ user: { phone: "+22890000001" } }] });
    expect(leaks).toEqual(["$.results[0].user.phone"]);
  });

  it("couvre bien le trust score du §34 dans la liste interdite", () => {
    expect(PRIVATE_KEYS).toContain("trustScore");
    expect(PRIVATE_KEYS).toContain("phone");
    expect(PRIVATE_KEYS).toContain("birthDate");
    expect(PRIVATE_KEYS).toContain("documentKeyEnc");
  });

  it("expose l'âge mais jamais la date de naissance", () => {
    const profile = toPublicProfile(makeUser())!;
    expect(profile.age).toBe(ageFromBirthDate(new Date("1997-04-12")));
    expect(JSON.stringify(profile)).not.toContain("1997-04-12");
  });

  it("n'affiche jamais une photo non modérée (M4)", () => {
    const profile = toPublicProfile(makeUser())!;
    expect(profile.photos).toHaveLength(1);
    expect(profile.photos[0]!.id).toBe("p1");
  });

  it("masque une section marquée privée (§47)", () => {
    const user = makeUser({
      faithProfile: {
        denomination: "CATHOLIC",
        commitmentLevel: "REGULAR",
        attendance: "WEEKLY",
        churchNameRaw: "Paroisse",
        faithInCouple: null,
        visibility: JSON.stringify({ faith: "PRIVATE" }),
        church: null,
      },
    });
    const profile = toPublicProfile(user)!;
    expect(profile.faith).toBeNull();
    expect(JSON.stringify(profile)).not.toContain("Paroisse");
  });

  it("n'ouvre une section « MATCHES » qu'après un match", () => {
    const user = makeUser({
      marriageVision: {
        wantsMarriage: "YES",
        timeline: "WITHIN_1Y",
        wantsChildren: "YES",
        residenceAfter: "OWN_HOME",
        visibility: JSON.stringify({ marriage: "MATCHES" }),
      },
    });
    expect(toPublicProfile(user, { isMatched: false })!.marriage).toBeNull();
    expect(toPublicProfile(user, { isMatched: true })!.marriage).not.toBeNull();
  });

  it("arrondit l'activité au lieu d'exposer un horodatage (§47)", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    expect(activityLabel(new Date("2026-06-15T08:00:00Z"), now)).toContain("aujourd'hui");
    expect(activityLabel(new Date("2026-06-11T08:00:00Z"), now)).toContain("semaine");
    expect(activityLabel(new Date("2026-01-11T08:00:00Z"), now)).toContain("Moins actif");
  });

  it("affiche « à discuter » plutôt qu'un choix inventé (§13)", () => {
    const profile = toPublicProfile(makeUser())!;
    expect(profile.marriage?.wantsChildrenLabel).toBe("À discuter");
  });
});

describe("Premium ne vend jamais la sécurité (§31, §60, C2)", () => {
  it("laisse toutes les capacités de sécurité gratuites", () => {
    for (const capability of NEVER_PAYWALLED) {
      expect(hasCapability("FREE", capability)).toBe(true);
    }
  });

  it("garde le badge visible par tout le monde", () => {
    expect(hasCapability("FREE", "badge.see")).toBe(true);
    expect(hasCapability("FREE", "verification.request")).toBe(true);
    expect(hasCapability("FREE", "safety.report")).toBe(true);
    expect(hasCapability("FREE", "match.chat")).toBe(true);
  });

  it("réserve seulement le confort à Premium, quand Premium existe", () => {
    // Régime « premium » explicite : la grille doit rester correcte le jour où
    // on la rallume, même si personne ne la voit pendant le lancement gratuit.
    expect(hasCapability("FREE", "discovery.advanced_filters", false)).toBe(false);
    expect(hasCapability("PREMIUM", "discovery.advanced_filters", false)).toBe(true);
    expect(hasCapability("FREE", "discovery.filter_verified_only", false)).toBe(false);
  });

  it("n'oppose aucun refus pendant le lancement gratuit (§1)", () => {
    for (const capability of CAPABILITIES) {
      expect(hasCapability("FREE", capability, true)).toBe(true);
    }
    expect(dailyLikeLimit("FREE", true)).toBe(dailyLikeLimit("PREMIUM", true));
    expect(railLimit("FREE", "verified", true)).toBe(railLimit("PREMIUM", "verified", true));
  });

  it("respecte la règle produit : la vérification est gratuite", () => {
    expect(productRules.verificationIsFree).toBe(true);
    expect(productRules.trustScoreIsInternalOnly).toBe(true);
  });
});

describe("RBAC — refus par défaut (§36, §50)", () => {
  it("ne donne aucune permission à un membre", () => {
    expect(permissionsFor("USER")).toHaveLength(0);
    expect(can("USER", "users.read")).toBe(false);
  });

  it("limite l'agent de vérification à son périmètre (§36)", () => {
    expect(can("VERIFIER", "verification.decide")).toBe(true);
    expect(can("VERIFIER", "verification.read_documents")).toBe(true);
    // « Il ne doit pas avoir accès aux fonctions inutiles. »
    expect(can("VERIFIER", "messages.read_flagged")).toBe(false);
    expect(can("VERIFIER", "payments.read")).toBe(false);
    expect(can("VERIFIER", "users.ban")).toBe(false);
    expect(can("VERIFIER", "admins.manage")).toBe(false);
  });

  it("empêche un modérateur de lire les pièces d'identité", () => {
    expect(can("MODERATOR", "reports.action")).toBe(true);
    expect(can("MODERATOR", "verification.read_documents")).toBe(false);
  });

  it("refuse un rôle inconnu", () => {
    expect(can("PIRATE", "users.read")).toBe(false);
  });
});

describe("anti-arnaque (§34)", () => {
  const cas = [
    "Peux-tu m'envoyer 50000 FCFA par T-Money ?",
    "J'ai besoin d'argent pour les frais de visa.",
    "Envoie-moi de l'argent via Western Union stp",
    "prête-moi de l'argent, je te rembourse",
  ];

  for (const message of cas) {
    it(`détecte : « ${message.slice(0, 32)}… »`, () => {
      const result = scanMessage(message);
      expect(result.signals.some((signal) => signal.kind === "MONEY_REQUEST")).toBe(true);
      expect(result.userWarning).toContain("Ne transférez jamais d'argent");
      expect(result.flagForReview).toBe(true);
    });
  }

  it("laisse passer une conversation normale", () => {
    const result = scanMessage("Bonjour, comment s'est passée ta semaine à l'église ?");
    expect(result.signals).toHaveLength(0);
    expect(result.userWarning).toBeNull();
  });

  it("signale une sortie de plateforme trop précoce", () => {
    const result = scanMessage("Donne-moi ton numéro, on continue sur WhatsApp");
    expect(result.signals.some((signal) => signal.kind === "RAPID_OFFPLATFORM")).toBe(true);
  });

  it("laisse un compte se racheter avec le temps", () => {
    const old = new Date(Date.now() - 400 * 86_400_000);
    const recent = new Date();
    const base = { phoneVerified: true, identityVerified: false, profileVerified: false, accountAgeDays: 500, reportsReceived: 0 };

    const withOldIncident = computeTrustScore({
      ...base,
      signals: [{ kind: "MONEY_REQUEST", weight: -30, createdAt: old }],
    });
    const withRecentIncident = computeTrustScore({
      ...base,
      signals: [{ kind: "MONEY_REQUEST", weight: -30, createdAt: recent }],
    });

    expect(withOldIncident).toBeGreaterThan(withRecentIncident);
  });

  it("borne le score et déclenche les bons effets", () => {
    const critical = computeTrustScore({
      signals: Array.from({ length: 10 }, () => ({ kind: "MONEY_REQUEST" as const, weight: -30, createdAt: new Date() })),
      phoneVerified: false,
      identityVerified: false,
      profileVerified: false,
      accountAgeDays: 1,
      reportsReceived: 5,
    });
    expect(critical).toBeGreaterThanOrEqual(0);
    expect(trustBand(critical)).toBe("CRITICAL");
    expect(trustEffects(critical).blockNewMatches).toBe(true);
  });
});

describe("modération (§35)", () => {
  it("commence par un avertissement pour un premier manquement", () => {
    const result = recommendSanction({ category: "INAPPROPRIATE", history: [], confirmed: true, recentConfirmedReports: 1 });
    expect(result.sanction).toBe("WARNING");
  });

  it("escalade en cas de récidive", () => {
    const result = recommendSanction({
      category: "INAPPROPRIATE",
      history: ["WARNING"],
      confirmed: true,
      recentConfirmedReports: 1,
    });
    expect(result.sanction).toBe("RESTRICTION");
  });

  it("suspend immédiatement en cas de soupçon de minorité", () => {
    const result = recommendSanction({ category: "UNDERAGE", history: [], confirmed: true, recentConfirmedReports: 1 });
    expect(result.sanction).toBe("SUSPENSION");
    expect(result.immediate).toBe(true);
    expect(result.requiresHumanReview).toBe(true);
  });

  it("ne laisse pas passer une demande d'argent au premier incident", () => {
    const result = recommendSanction({ category: "SCAM_MONEY", history: [], confirmed: true, recentConfirmedReports: 1 });
    expect(result.sanction).toBe("SUSPENSION");
    expect(result.immediate).toBe(true);
    expect(isZeroTolerance("SCAM_MONEY")).toBe(true);
  });

  it("ne sanctionne jamais automatiquement un signalement non confirmé", () => {
    const result = recommendSanction({ category: "SCAM_MONEY", history: [], confirmed: false, recentConfirmedReports: 0 });
    expect(result.requiresHumanReview).toBe(true);
    expect(result.immediate).toBe(false);
  });
});

describe("vérification (§25-§30)", () => {
  it("accompagne chaque niveau de ce qu'il ne prouve pas (§25)", () => {
    for (const level of VERIFICATION_LEVELS) {
      expect(LEVELS[level].meaning.length).toBeGreaterThan(20);
      expect(LEVELS[level].limitation.length).toBeGreaterThan(20);
    }
  });

  it("n'accorde le badge EDENIA qu'après une vérification humaine (§30)", () => {
    expect(
      hasEdeniaBadge({ phoneVerified: true, emailVerified: true, identityStatus: "NONE", profileStatus: "NONE", churchStatus: "NONE" }),
    ).toBe(false);
    expect(
      hasEdeniaBadge({ phoneVerified: true, emailVerified: false, identityStatus: "APPROVED", profileStatus: "NONE", churchStatus: "NONE" }),
    ).toBe(true);
  });

  it("refuse une approbation dont la liste de contrôle est incomplète (§27)", () => {
    const result = validateDecision({ kind: "IDENTITY", checkedCodes: ["DOC_VALID"], approve: true });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("contrôle");
  });

  it("accepte une approbation complète", () => {
    const result = validateDecision({
      kind: "IDENTITY",
      checkedCodes: ["DOC_VALID", "DOC_MATCHES_SELFIE", "AGE_18", "NAME_MATCHES", "NO_TAMPERING"],
      approve: true,
    });
    expect(result.valid).toBe(true);
  });

  it("exige un motif pour un refus", () => {
    expect(validateDecision({ kind: "PROFILE", checkedCodes: [], approve: false, reason: "non" }).valid).toBe(false);
    expect(
      validateDecision({ kind: "PROFILE", checkedCodes: [], approve: false, reason: "Photos introuvables sur le dossier." }).valid,
    ).toBe(true);
  });
});
