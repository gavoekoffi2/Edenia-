import { describe, expect, it } from "vitest";
import { DEV_OTP_CODE, authLimits, isDevAuth, serviceStatuses, showDevIndicator } from "@/lib/config/mode";
import { generateCode, maskDestination, normalizePhone } from "@/lib/auth/otp";
import { PHONE_RULES, formatPhone, phoneRuleFor, validatePhone } from "@/lib/geo/phone";
import { COUNTRIES, PILOT_COUNTRY, dialCodeOptions, isSingleCountryMode } from "@/lib/geo/data";
import { autoModerate, ACCEPTED_MIME, MAX_PHOTOS_PER_USER } from "@/lib/storage/photos";
import { hashWithSalt, newSalt, safeEquals } from "@/lib/crypto/field";

describe("mode développement — l'authentification est simulée, jamais désactivée", () => {
  it("produit un code prévisible et documenté", () => {
    expect(isDevAuth).toBe(true);
    expect(generateCode()).toBe(DEV_OTP_CODE);
    expect(DEV_OTP_CODE).toMatch(/^\d{6}$/);
  });

  it("conserve tout le mécanisme de vérification : hachage salé et comparaison à temps constant", () => {
    // C'est le point central : le code est connu, mais le chemin de
    // vérification reste rigoureusement celui de la production.
    const salt = newSalt();
    const stored = hashWithSalt(DEV_OTP_CODE, salt);

    expect(stored).not.toContain(DEV_OTP_CODE);
    expect(stored).toHaveLength(64);
    expect(safeEquals(hashWithSalt(DEV_OTP_CODE, salt), stored)).toBe(true);
    expect(safeEquals(hashWithSalt("000000", salt), stored)).toBe(false);

    // Deux sels différents produisent deux empreintes différentes : le code
    // fixe ne crée pas une empreinte unique réutilisable.
    expect(hashWithSalt(DEV_OTP_CODE, newSalt())).not.toBe(stored);
  });

  it("garde la limitation de débit active, à un seuil adapté aux tests", () => {
    expect(authLimits.otpRequestPerHourPerDestination).toBeGreaterThan(0);
    expect(Number.isFinite(authLimits.otpRequestPerHourPerDestination)).toBe(true);
    expect(authLimits.otpVerifyPerWindow).toBeGreaterThan(0);
  });

  it("signale l'environnement de test et énumère les services simulés", () => {
    expect(showDevIndicator).toBe(true);
    const services = serviceStatuses();
    expect(services.find((s) => s.key === "auth")?.mode).toBe("development");
    // Chaque service dit ce qu'il fait réellement, sans ambiguïté.
    for (const service of services) {
      expect(service.detail.length).toBeGreaterThan(20);
    }
  });

  it("masque toujours la destination affichée", () => {
    expect(maskDestination("PHONE", "+22890123456")).toContain("••");
    expect(maskDestination("PHONE", "+22890123456")).not.toContain("9012");
    expect(maskDestination("EMAIL", "kodjo@exemple.com")).toBe("ko•••@exemple.com");
  });
});

describe("numéros togolais (§4, §8)", () => {
  it("accepte la saisie locale sous toutes ses formes courantes", () => {
    const attendu = "+22890123456";
    for (const saisie of ["90123456", "90 12 34 56", "90-12-34-56", "+228 90 12 34 56", "0022890123456"]) {
      const result = validatePhone(saisie, "TG");
      expect(result.ok, `« ${saisie} » devrait être accepté`).toBe(true);
      if (result.ok) expect(result.e164).toBe(attendu);
    }
  });

  it("accepte les deux préfixes mobiles togolais (7 et 9)", () => {
    expect(validatePhone("70123456", "TG").ok).toBe(true);
    expect(validatePhone("99887766", "TG").ok).toBe(true);
  });

  it("refuse un numéro de mauvaise longueur, avec un motif utile", () => {
    const result = validatePhone("9012345", "TG");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("8 chiffres");
    }
  });

  it("refuse un fixe en expliquant pourquoi — un OTP n'y arrivera pas", () => {
    const result = validatePhone("22123456", "TG");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("mobile");
  });

  it("refuse un indicatif étranger sur un compte togolais", () => {
    expect(validatePhone("+33612345678", "TG").ok).toBe(false);
  });

  it("refuse un préfixe mobile inexistant au Togo", () => {
    expect(validatePhone("50123456", "TG").ok).toBe(false);
  });

  it("reste extensible : les règles des marchés suivants sont déjà là", () => {
    for (const code of ["BJ", "CI", "CM", "SN"]) {
      expect(phoneRuleFor(code), `règle manquante pour ${code}`).toBeDefined();
    }
    expect(validatePhone("671234567", "CM").ok).toBe(true);
    expect(validatePhone("771234567", "SN").ok).toBe(true);
  });

  it("formate lisiblement pour l'affichage", () => {
    expect(formatPhone("+22890123456")).toBe("+228 90 12 34 56");
  });

  it("normalizePhone reste cohérent avec validatePhone", () => {
    expect(normalizePhone("90 12 34 56", "TG")).toBe("+22890123456");
    expect(normalizePhone("12345", "TG")).toBeNull();
  });
});

describe("phase pilote Togo-first (§1, §8)", () => {
  it("n'expose que le Togo dans le sélecteur de pays", () => {
    const options = dialCodeOptions();
    expect(options).toHaveLength(1);
    expect(options[0]!.code).toBe(PILOT_COUNTRY);
    expect(options[0]!.dialCode).toBe("+228");
    expect(isSingleCountryMode()).toBe(true);
  });

  it("garde les marchés suivants dans le référentiel, prêts à être ouverts", () => {
    const codes = COUNTRIES.map((c) => c.code);
    for (const code of ["BJ", "CI", "CM", "SN", "CD", "BF"]) {
      expect(codes).toContain(code);
    }
    // Extensibilité réelle : ouvrir un pays est un changement de donnée.
    const benin = COUNTRIES.find((c) => c.code === "BJ")!;
    expect(benin.isLaunched).toBe(false);
    expect(benin.launchOrder).toBe(2);
    expect(dialCodeOptions(false).length).toBeGreaterThan(1);
  });

  it("couvre les villes togolaises attendues pour le pilote", () => {
    const togo = COUNTRIES.find((c) => c.code === "TG")!;
    const villes = togo.regions.flatMap((r) => r.cities.map((c) => c.nameFr));
    for (const ville of ["Lomé", "Tsévié", "Kpalimé", "Atakpamé", "Sokodé", "Kara", "Dapaong"]) {
      expect(villes, `${ville} manquante`).toContain(ville);
    }
  });
});

describe("photos", () => {
  const photo = { storageKey: "k", width: 1080, height: 1080, bytes: 90_000, blurhash: "data:," };

  it("auto-approuve en développement, mais le dit explicitement", () => {
    const verdict = autoModerate(photo, { devMode: true });
    expect(verdict.status).toBe("APPROVED");
    // §9 : le raccourci doit être tracé, jamais silencieux.
    expect(verdict.reason).toContain("développement");
  });

  it("passe par une revue humaine en production", () => {
    const verdict = autoModerate(photo, { devMode: false });
    expect(verdict.status).toBe("PENDING");
    expect(verdict.reason).toContain("modération");
  });

  it("refuse une image trop petite dans les deux modes", () => {
    const tiny = { ...photo, width: 100, height: 100 };
    expect(autoModerate(tiny, { devMode: true }).status).toBe("REJECTED");
    expect(autoModerate(tiny, { devMode: false }).status).toBe("REJECTED");
  });

  it("borne les formats acceptés et le nombre de photos", () => {
    expect(ACCEPTED_MIME).toContain("image/jpeg");
    expect(ACCEPTED_MIME).not.toContain("image/svg+xml"); // vecteur d'injection
    expect(MAX_PHOTOS_PER_USER).toBeGreaterThan(0);
  });
});

describe("garde-fous du mode développement (§11)", () => {
  it("le code de test n'est jamais un secret de production", () => {
    // Le code est public par construction : il ne doit donc protéger que des
    // données de test. C'est pourquoi env.ts interdit ce mode en production.
    expect(DEV_OTP_CODE).toBe("228228");
  });

  it("chaque service simulé est signalé comme restant à brancher", () => {
    const simulated = serviceStatuses().filter((s) => s.mode === "development");
    expect(simulated.length).toBeGreaterThan(0);
    for (const service of simulated) {
      // L'IA locale fait exception : elle est fonctionnelle, pas un bouchon.
      if (service.key === "ai") continue;
      expect(service.pendingRealIntegration, `${service.key} devrait être marqué à brancher`).toBe(true);
    }
  });

  it("les règles de numérotation ne sont pas codées en dur dans le formulaire", () => {
    // Ouvrir un marché = ajouter une entrée ici, rien d'autre.
    expect(Object.keys(PHONE_RULES).length).toBeGreaterThanOrEqual(5);
  });
});
