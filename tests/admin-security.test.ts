import { describe, expect, it } from "vitest";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/admin/password";
import {
  base32Decode,
  base32Encode,
  consumeRecoveryCode,
  currentTotp,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "@/lib/admin/totp";
import { adminFingerprint } from "@/lib/admin/session";
import { ROLES, can, isStaff, normalizeRole, permissionsFor } from "@/lib/auth/rbac";
import { sectionsFor, landingSection } from "@/lib/admin/sections";

describe("mots de passe administrateur (§9)", () => {
  it("ne stocke jamais le mot de passe en clair", async () => {
    const hash = await hashPassword("la mangue du jardin de tante Afi");
    expect(hash).not.toContain("mangue");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("produit une empreinte différente à chaque fois (sel aléatoire)", async () => {
    const a = await hashPassword("la mangue du jardin de tante Afi");
    const b = await hashPassword("la mangue du jardin de tante Afi");
    expect(a).not.toBe(b);
  });

  it("vérifie le bon mot de passe et rejette les autres", async () => {
    const hash = await hashPassword("la mangue du jardin de tante Afi");
    expect(await verifyPassword("la mangue du jardin de tante Afi", hash)).toBe(true);
    expect(await verifyPassword("la mangue du jardin de tante afi", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("refuse une empreinte absente ou malformée sans lever d'exception", async () => {
    expect(await verifyPassword("peu importe", null)).toBe(false);
    expect(await verifyPassword("peu importe", "")).toBe(false);
    expect(await verifyPassword("peu importe", "bcrypt$1$2")).toBe(false);
    expect(await verifyPassword("peu importe", "scrypt$1$2$3$4$5")).toBe(false);
  });

  it("exige de la longueur plutôt que des symboles décoratifs", () => {
    expect(checkPasswordStrength("Chien2024!").ok).toBe(false);
    expect(checkPasswordStrength("la mangue du jardin de tante Afi").ok).toBe(true);
  });

  it("refuse un mot de passe contenant le nom du compte", () => {
    const result = checkPasswordStrength("edenia administrateur 2026", ["Administrateur"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("ne doit pas contenir");
  });

  it("refuse une répétition sans entropie", () => {
    expect(checkPasswordStrength("aaaaaaaaaaaaaaa").ok).toBe(false);
  });
});

describe("second facteur TOTP (§50)", () => {
  it("encode et décode en base32 sans perte", () => {
    const buffer = Buffer.from("EDENIA-TEST-1234");
    expect(base32Decode(base32Encode(buffer)).equals(buffer)).toBe(true);
  });

  it("produit un code à 6 chiffres", () => {
    const secret = generateTotpSecret();
    expect(currentTotp(secret)).toMatch(/^\d{6}$/);
  });

  it("respecte le vecteur RFC 6238 (SHA-1, secret « 12345678901234567890 »)", () => {
    // Le secret du RFC en ASCII, encodé en base32 comme le veut otpauth.
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    // T = 59 s → compteur 1 ; valeur attendue par le RFC pour SHA-1 / 8 chiffres
    // est 94287082, dont les 6 derniers chiffres sont 287082.
    expect(totpCode(secret, 1)).toBe("287082");
  });

  it("accepte le code courant et refuse un code faux", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, currentTotp(secret))).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("tolère ±30 secondes de dérive, pas davantage", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(secret, currentTotp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, currentTotp(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, currentTotp(secret, now - 120_000), now)).toBe(false);
  });

  it("produit une URI otpauth lisible par les applications standard", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "admin@edenia.app");
    expect(uri.startsWith("otpauth://totp/EDENIA:admin%40edenia.app?")).toBe(true);
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("codes de récupération (§9)", () => {
  it("en génère dix, tous distincts", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("consomme un code, une seule fois", () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);

    const first = consumeRecoveryCode(hashes, codes[3]!);
    expect(first.ok).toBe(true);
    expect(first.remaining).toHaveLength(9);

    const replay = consumeRecoveryCode(first.remaining, codes[3]!);
    expect(replay.ok).toBe(false);
    expect(replay.remaining).toHaveLength(9);
  });

  it("ignore la casse et les tirets à la saisie", () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    const typed = codes[0]!.toLowerCase().replace("-", "");
    expect(consumeRecoveryCode(hashes, typed).ok).toBe(true);
  });

  it("ne stocke pas le code en clair", () => {
    const code = generateRecoveryCodes(1)[0]!;
    expect(hashRecoveryCode(code)).not.toContain(code.replace("-", ""));
  });
});

describe("session d'administration (§50)", () => {
  const base = {
    roleCode: "ADMIN",
    isActive: true,
    passwordSetAt: new Date("2026-01-01T00:00:00Z"),
    mfaEnabledAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("produit la même empreinte pour un état inchangé", () => {
    expect(adminFingerprint(base)).toBe(adminFingerprint({ ...base }));
  });

  it("invalide la session quand le mot de passe change", () => {
    expect(adminFingerprint({ ...base, passwordSetAt: new Date("2026-06-01T00:00:00Z") })).not.toBe(
      adminFingerprint(base),
    );
  });

  it("invalide la session quand le MFA est réinitialisé", () => {
    expect(adminFingerprint({ ...base, mfaEnabledAt: null })).not.toBe(adminFingerprint(base));
  });

  it("invalide la session quand le rôle change ou que le compte est désactivé", () => {
    expect(adminFingerprint({ ...base, roleCode: "MODERATOR" })).not.toBe(adminFingerprint(base));
    expect(adminFingerprint({ ...base, isActive: false })).not.toBe(adminFingerprint(base));
  });
});

describe("rôles internes (§36)", () => {
  it("reconnaît l'ancien code VERIFICATION_AGENT sans lui rendre plus de droits", () => {
    expect(normalizeRole("VERIFICATION_AGENT")).toBe("VERIFIER");
    expect(permissionsFor("VERIFICATION_AGENT")).toEqual(permissionsFor("VERIFIER"));
    expect(can("VERIFICATION_AGENT", "admins.manage")).toBe(false);
  });

  it("refuse un rôle inconnu, sans exception", () => {
    expect(normalizeRole("ROI")).toBeNull();
    expect(permissionsFor("ROI")).toHaveLength(0);
    expect(isStaff("ROI")).toBe(false);
    expect(can("ROI", "users.read")).toBe(false);
  });

  it("réserve la gestion des administrateurs au seul administrateur principal", () => {
    for (const role of ROLES) {
      if (role === "SUPER_ADMIN") continue;
      expect(can(role, "admins.manage")).toBe(false);
      expect(can(role, "settings.write")).toBe(false);
    }
  });

  it("sépare suspendre et bannir", () => {
    // La route /api/v1/admin/users authentifie sur « users.suspend » puis exige
    // « users.ban » une fois le corps lu. Cette échelle doit rester réelle :
    // un modérateur suspend, il ne bannit pas.
    expect(can("MODERATOR", "users.suspend")).toBe(true);
    expect(can("MODERATOR", "users.ban")).toBe(false);
    expect(can("ADMIN", "users.ban")).toBe(true);
    // Quiconque peut bannir peut suspendre — sinon la garde d'entrée de la
    // route rejetterait un administrateur légitime avant même de lire le corps.
    for (const role of ROLES) {
      if (can(role, "users.ban")) expect(can(role, "users.suspend")).toBe(true);
    }
  });

  it("n'ouvre au vérificateur que les sections dont il a besoin", () => {
    const sections = sectionsFor("VERIFIER").map((section) => section.href);
    expect(sections).toContain("/admin/verification");
    expect(sections).not.toContain("/admin/paiements");
    expect(sections).not.toContain("/admin/dons");
    expect(sections).not.toContain("/admin/administrateurs");
  });

  it("envoie chaque rôle sur une page qu'il peut réellement ouvrir", () => {
    for (const role of ROLES) {
      if (role === "USER") continue;
      const landing = landingSection(role);
      expect(landing).not.toBe("/admin/refuse");
      const section = sectionsFor(role).find((item) => item.href === landing);
      expect(section).toBeDefined();
      expect(can(role, section!.permission)).toBe(true);
    }
  });
});
