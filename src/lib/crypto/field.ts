import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

/**
 * Chiffrement au niveau champ (§47).
 *
 * Utilise pour les donnees dont la fuite serait la plus grave : references de
 * documents d'identite, selfies de verification, contact de confiance d'un
 * rendez-vous. AES-256-GCM, avec un IV aleatoire par valeur et l'authentification
 * integree — un chiffre modifie ne se dechiffre pas silencieusement.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  const raw = env.FIELD_ENCRYPTION_KEY;
  // La cle peut etre fournie en base64 (32 octets) ou en texte : on derive dans
  // tous les cas vers 32 octets pour eviter un echec silencieux de longueur.
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

/** Rend `iv.tag.ciphertext`, le tout en base64url. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptField(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Format de champ chiffré invalide.");
  const [ivRaw, tagRaw, dataRaw] = parts as [string, string, string];

  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("Format de champ chiffré invalide.");
  }

  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

/** Dechiffrement tolerant : rend null au lieu de lever, pour les affichages. */
export function tryDecryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptField(payload);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hachages
// ---------------------------------------------------------------------------

/** Hachage sale, pour les codes OTP (courts, donc jamais stockes en clair). */
export function hashWithSalt(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Comparaison a temps constant — evite de fuir le code par le temps de reponse. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Pseudonymisation stable pour les journaux d'audit (§47) : permet de suivre un
 * acteur dans le temps sans conserver son identifiant en clair apres suppression.
 */
export function pseudonymize(value: string): string {
  return createHash("sha256").update(`edenia-audit:${env.SESSION_SECRET}:${value}`).digest("hex").slice(0, 32);
}

/** Empreinte d'IP pour la limitation de debit, sans conserver l'IP. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`edenia-ip:${env.SESSION_SECRET}:${ip}`).digest("hex").slice(0, 32);
}
