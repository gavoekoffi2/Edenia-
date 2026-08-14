import { describe, expect, it } from "vitest";
import {
  DONATION_GRANTS_NOTHING,
  canUsePremiumFeature,
  effectiveLikeLimit,
  isFreeLaunch,
  monetizationMode,
  premiumIsPublic,
} from "@/lib/config/monetization";
import { isDonationRef, MAX_DONATION_XOF, MIN_DONATION_XOF } from "@/lib/donations/service";
import { NEVER_PAYWALLED } from "@/lib/premium/entitlements";
import { decideTransition, grantsPremium, statusFromEvent } from "@/lib/payments/status";
import { SETTING_DEFINITIONS } from "@/lib/settings/service";
import { PHOTO_MODERATION_STATUSES, autoModerate } from "@/lib/storage/photos";
import {
  VERIFICATION_GRANTING,
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABEL,
} from "@/lib/config/enums";
import {
  VERIFICATION_VALIDITY_MONTHS,
  achievedLevels,
  hasEdeniaBadge,
  verificationExpiryFrom,
} from "@/lib/verification/levels";

describe("lancement gratuit (§1, §2)", () => {
  it("part du mode gratuit par défaut", () => {
    // Un oubli de configuration ne doit jamais facturer quelqu'un par accident.
    expect(["free", "donations"]).toContain(monetizationMode);
    expect(isFreeLaunch).toBe(true);
    expect(premiumIsPublic).toBe(false);
  });

  it("n'oppose aucun refus de fonctionnalité", () => {
    expect(canUsePremiumFeature(false)).toBe(true);
    expect(canUsePremiumFeature(true)).toBe(true);
  });

  it("accorde le même quota à tout le monde", () => {
    const limits = { free: 20, premium: 100 };
    expect(effectiveLikeLimit(false, limits)).toBe(100);
    expect(effectiveLikeLimit(true, limits)).toBe(100);
  });
});

describe("un don n'achète rien (§5)", () => {
  it("énumère explicitement ce qu'un don ne donne pas", () => {
    for (const forbidden of ["badge", "verification", "visibility", "matching-boost", "extra-likes"]) {
      expect(DONATION_GRANTS_NOTHING).toContain(forbidden);
    }
  });

  it("n'intersecte jamais la liste des capacités gratuites : elles le sont déjà pour tous", () => {
    // Si un « avantage donateur » apparaissait un jour dans NEVER_PAYWALLED,
    // ce serait le signe qu'on a commencé à vendre ce qui doit rester gratuit.
    for (const capability of NEVER_PAYWALLED) {
      expect(DONATION_GRANTS_NOTHING).not.toContain(capability);
    }
  });

  it("distingue une référence de don d'une référence d'abonnement", () => {
    expect(isDonationRef("DON-ABC123-XYZ")).toBe(true);
    expect(isDonationRef("EDN-ABC123-XYZ")).toBe(false);
    expect(isDonationRef(null)).toBe(false);
    expect(isDonationRef(undefined)).toBe(false);
  });

  it("borne les montants acceptés", () => {
    expect(MIN_DONATION_XOF).toBeGreaterThanOrEqual(200);
    expect(MAX_DONATION_XOF).toBeLessThanOrEqual(2_000_000);
  });

  it("réutilise la machine d'état des paiements, sans en dériver un droit", () => {
    expect(statusFromEvent("payment.success")).toBe("COMPLETED");
    // `grantsPremium` reste vrai pour un paiement encaissé — mais aucun code du
    // module de dons ne l'appelle : c'est la séparation qui protège, pas le nom.
    expect(grantsPremium("COMPLETED")).toBe(true);
    expect(decideTransition("COMPLETED", "PENDING").apply).toBe(false);
    expect(decideTransition("COMPLETED", "REFUNDED").apply).toBe(true);
  });
});

describe("réglages d'exploitation (§22)", () => {
  it("expose un interrupteur pour fermer les dons", () => {
    const donation = SETTING_DEFINITIONS.find((item) => item.key === "support.donations_open");
    expect(donation).toBeDefined();
    expect(donation!.type).toBe("boolean");
    expect(donation!.defaultValue).toBe("true");
  });

  it("protège les réglages sensibles derrière le rôle principal", () => {
    const discovery = SETTING_DEFINITIONS.find((item) => item.key === "access.discovery_open");
    expect(discovery?.isProtected).toBe(true);
  });

  it("ne laisse aucun réglage sans libellé ni explication", () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition.label.length).toBeGreaterThan(3);
      expect(definition.help.length).toBeGreaterThan(10);
    }
  });
});

describe("modération automatique des photos (M4)", () => {
  const base = { storageKey: "k", width: 1080, height: 1080, bytes: 90_000, blurhash: "" };

  it("rejette une image trop petite sans déranger un humain", () => {
    const verdict = autoModerate({ ...base, width: 80, height: 80 }, { devMode: false });
    expect(verdict.status).toBe("REJECTED");
  });

  it("demande un examen humain sur un format extrême", () => {
    const verdict = autoModerate({ ...base, width: 1200, height: 300 }, { devMode: false });
    expect(verdict.status).toBe("REVIEW_REQUIRED");
    expect(verdict.reason).toContain("capture d'écran");
  });

  it("demande un examen humain sur une image trop peu détaillée", () => {
    const verdict = autoModerate({ ...base, bytes: 1_200 }, { devMode: false });
    expect(verdict.status).toBe("REVIEW_REQUIRED");
  });

  it("met en file ordinaire une photo sans signal particulier", () => {
    expect(autoModerate(base, { devMode: false }).status).toBe("PENDING");
  });

  it("dit explicitement quand une approbation vient du mode développement", () => {
    const verdict = autoModerate(base, { devMode: true });
    expect(verdict.status).toBe("APPROVED");
    expect(verdict.reason).toContain("mode développement");
  });

  it("le doute reste prioritaire sur la file ordinaire, jamais confondu avec elle", () => {
    expect(PHOTO_MODERATION_STATUSES).toContain("REVIEW_REQUIRED");
    expect(PHOTO_MODERATION_STATUSES).toContain("PENDING");
    expect(new Set(PHOTO_MODERATION_STATUSES).size).toBe(PHOTO_MODERATION_STATUSES.length);
  });
});

describe("validité des vérifications (§29, §31)", () => {
  const base = {
    phoneVerified: true,
    emailVerified: false,
    profileStatus: "NONE",
    churchStatus: "NONE",
  };

  it("expose le vocabulaire produit sans renommer les valeurs stockées", () => {
    expect(VERIFICATION_STATUS).toContain("EXPIRED");
    expect(VERIFICATION_STATUS_LABEL.APPROVED).toBe("Vérifié");
    expect(VERIFICATION_STATUS_LABEL.IN_REVIEW).toBe("En cours d'examen");
    expect(VERIFICATION_STATUS_LABEL.EXPIRED).toBe("Expiré");
    // Chaque statut stocké a une traduction : aucun code brut ne peut fuir à l'écran.
    for (const status of VERIFICATION_STATUS) {
      expect(VERIFICATION_STATUS_LABEL[status].length).toBeGreaterThan(2);
    }
  });

  it("n'accorde un niveau que sur APPROVED", () => {
    expect(VERIFICATION_GRANTING).toEqual(["APPROVED"]);
    expect(achievedLevels({ ...base, identityStatus: "APPROVED" })).toContain("IDENTITY");
    for (const status of VERIFICATION_STATUS) {
      if (status === "APPROVED") continue;
      expect(achievedLevels({ ...base, identityStatus: status })).not.toContain("IDENTITY");
    }
  });

  it("retire le badge dès que la vérification expire", () => {
    expect(hasEdeniaBadge({ ...base, identityStatus: "APPROVED" })).toBe(true);
    expect(hasEdeniaBadge({ ...base, identityStatus: "EXPIRED" })).toBe(false);
  });

  it("calcule une échéance à 24 mois", () => {
    const decided = new Date("2026-03-15T10:00:00Z");
    const expiry = verificationExpiryFrom(decided);
    expect(expiry.getFullYear()).toBe(2028);
    expect(expiry.getMonth()).toBe(decided.getMonth());
    expect(VERIFICATION_VALIDITY_MONTHS).toBe(24);
  });

  it("ne modifie jamais la date de décision d'origine", () => {
    const decided = new Date("2026-03-15T10:00:00Z");
    const copy = new Date(decided);
    verificationExpiryFrom(decided);
    expect(decided.getTime()).toBe(copy.getTime());
  });
});
