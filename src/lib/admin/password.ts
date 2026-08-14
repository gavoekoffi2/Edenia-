import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * §9 — mots de passe des comptes internes.
 *
 * scrypt plutot que bcrypt : il est dans la bibliotheque standard de Node, donc
 * pas de dependance native a compiler sur le serveur, et il resiste mieux aux
 * attaques materielles grace a son cout memoire.
 *
 * Le format stocke est `scrypt$N$r$p$sel$empreinte`, tout en base64url. Les
 * parametres voyagent avec l'empreinte : on pourra les durcir plus tard sans
 * invalider les mots de passe existants.
 */

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const keylen = Buffer.from(parts[5]!, "base64url").length;
  if (keylen === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), Buffer.from(parts[4]!, "base64url"), keylen);
  } catch {
    return false;
  }

  const expected = Buffer.from(parts[5]!, "base64url");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

/**
 * §9 — exigences minimales. Volontairement fondees sur la longueur plutot que
 * sur des classes de caracteres : « Chien2024! » satisfait toutes les regles
 * classiques et se casse en quelques secondes, « la mangue du jardin de tante
 * Afi » non.
 */
export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

const COMMON = new Set([
  "motdepasse",
  "password",
  "azertyuiop",
  "qwertyuiop",
  "123456789012",
  "edenia2025",
  "edenia2026",
  "administrateur",
]);

export function checkPasswordStrength(password: string, context: string[] = []): PasswordCheck {
  const problems: string[] = [];
  const value = password.normalize("NFKC");

  if (value.length < 12) problems.push("Au moins 12 caractères.");
  if (value.length > 200) problems.push("200 caractères au maximum.");
  if (/^\s|\s$/.test(value)) problems.push("Pas d'espace au début ni à la fin.");

  const lowered = value.toLowerCase();
  if (COMMON.has(lowered.replace(/[^a-z0-9]/g, ""))) {
    problems.push("Ce mot de passe est trop courant.");
  }
  for (const item of context) {
    const needle = item.trim().toLowerCase();
    if (needle.length >= 4 && lowered.includes(needle)) {
      problems.push("Le mot de passe ne doit pas contenir votre nom ni votre adresse e-mail.");
      break;
    }
  }
  if (new Set(lowered).size < 6) problems.push("Trop peu de caractères différents.");

  return { ok: problems.length === 0, problems };
}
