import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * §50, §9 — double facteur TOTP (RFC 6238).
 *
 * Implementation locale plutot qu'une dependance : l'algorithme tient en
 * quarante lignes, et une bibliotheque de plus dans la chaine
 * d'authentification est une surface d'attaque de plus.
 *
 * Compatible Google Authenticator, Authy, FreeOTP, Aegis : SHA-1, 6 chiffres,
 * pas de 30 secondes. Ce choix n'est pas une faiblesse — HMAC-SHA1 reste sur
 * pour ce cas d'usage, et s'en ecarter rendrait le secret illisible par la
 * quasi-totalite des applications que les administrateurs ont deja.
 */

const DIGITS = 6;
const PERIOD = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentTotp(secret: string, at: number = Date.now()): string {
  return totpCode(secret, Math.floor(at / 1000 / PERIOD));
}

/**
 * Verification avec une fenetre de tolerance.
 *
 * `window = 1` accepte le code precedent et le suivant, soit ±30 secondes.
 * C'est le reglage standard : les telephones d'entree de gamme derivent
 * facilement de quelques secondes, et refuser un code pour cela genererait
 * surtout des appels au support.
 */
export function verifyTotp(secret: string, code: string, at: number = Date.now(), window = 1): boolean {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;

  const counter = Math.floor(at / 1000 / PERIOD);
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = totpCode(secret, counter + drift);
    // Comparaison a temps constant : la duree de la reponse ne doit rien
    // apprendre sur le code attendu.
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(cleaned))) return true;
  }
  return false;
}

/** URI standard, lue par toutes les applications d'authentification. */
export function otpauthUri(secret: string, account: string, issuer = "EDENIA"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Secret decoupe en blocs de 4 : saisie manuelle possible si le QR ne passe pas. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

// --- Codes de recuperation --------------------------------------------------

/**
 * §9 — dix codes a usage unique, remis une seule fois.
 *
 * Ils sont haches comme des mots de passe courts (SHA-256 suffit : ce sont des
 * secrets a haute entropie, pas des mots de passe choisis par un humain) et
 * consommes a l'usage. Perdre son telephone ne doit pas signifier perdre la
 * plateforme.
 */
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z2-7]/g, "");
  return createHmac("sha256", "edenia-recovery").update(normalized).digest("hex");
}

/**
 * Consomme un code s'il est valide. Rend la liste restante, ce qui force
 * l'appelant a la persister — un code de recuperation reutilisable ne serait
 * plus un code de recuperation.
 */
export function consumeRecoveryCode(
  hashes: string[],
  code: string,
): { ok: boolean; remaining: string[] } {
  const candidate = hashRecoveryCode(code);
  const index = hashes.indexOf(candidate);
  if (index === -1) return { ok: false, remaining: hashes };
  const remaining = [...hashes.slice(0, index), ...hashes.slice(index + 1)];
  return { ok: true, remaining };
}
