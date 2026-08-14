import { randomInt } from "node:crypto";
import { hashWithSalt, newSalt, safeEquals } from "@/lib/crypto/field";
import { DEV_OTP_CODE, authLimits, isDevAuth } from "@/lib/config/mode";
import { validatePhone } from "@/lib/geo/phone";

/**
 * §8 et §50 — inscription par un seul canal verifie, avec OTP.
 *
 * Le module est pur : il ne connait ni Prisma ni HTTP, pour rester testable.
 * La persistance est injectee via `OtpStore`.
 */

export type OtpChannel = "PHONE" | "EMAIL";
export type OtpPurpose = "SIGNUP" | "LOGIN" | "ADD_CONTACT" | "RECOVERY";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
/**
 * Demandes autorisees par destination et par heure. Le seuil est plus large en
 * developpement pour ne pas bloquer une session de test qui cree plusieurs
 * comptes d'affilee — le mecanisme, lui, reste actif dans les deux modes.
 */
export const OTP_MAX_CHALLENGES_PER_HOUR = authLimits.otpRequestPerHourPerDestination;

export interface OtpRecord {
  id: string;
  channel: OtpChannel;
  destination: string;
  codeHash: string;
  salt: string;
  purpose: OtpPurpose;
  attempts: number;
  maxAttempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface OtpStore {
  create(record: Omit<OtpRecord, "id">): Promise<OtpRecord>;
  findById(id: string): Promise<OtpRecord | null>;
  countRecent(destination: string, since: Date): Promise<number>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string): Promise<void>;
}

/**
 * Genere le code OTP.
 *
 * En mode developpement, le code est **previsible** (constante documentee,
 * affichee dans l'interface). C'est la seule difference avec la production :
 * le code est ensuite hache avec un sel, stocke, compare a temps constant,
 * soumis au compteur de tentatives et a l'expiration, exactement comme un code
 * aleatoire. On teste donc le vrai chemin de verification, pas un raccourci.
 */
export function generateCode(length = OTP_LENGTH): string {
  if (isDevAuth) return DEV_OTP_CODE;
  let code = "";
  for (let i = 0; i < length; i += 1) code += randomInt(0, 10).toString();
  return code;
}

export interface RequestOtpResult {
  ok: boolean;
  challengeId?: string;
  /** Code en clair — a transmettre au canal, jamais au client. */
  code?: string;
  expiresAt?: Date;
  error?: "RATE_LIMITED" | "INVALID_DESTINATION";
  retryAfterSeconds?: number;
}

export interface RequestOtpInput {
  channel: OtpChannel;
  destination: string;
  purpose: OtpPurpose;
  store: OtpStore;
  now?: Date;
}

export async function requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
  const now = input.now ?? new Date();
  const destination = input.destination.trim();
  if (!destination) return { ok: false, error: "INVALID_DESTINATION" };

  // §50 : limitation de debit par destination — empeche l'usage d'EDENIA comme
  // passerelle SMS gratuite et protege le budget d'envoi.
  const since = new Date(now.getTime() - 3_600_000);
  const recent = await input.store.countRecent(destination, since);
  if (recent >= OTP_MAX_CHALLENGES_PER_HOUR) {
    return { ok: false, error: "RATE_LIMITED", retryAfterSeconds: 3600 };
  }

  const code = generateCode();
  const salt = newSalt();
  const record = await input.store.create({
    channel: input.channel,
    destination,
    codeHash: hashWithSalt(code, salt),
    salt,
    purpose: input.purpose,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    consumedAt: null,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    createdAt: now,
  });

  return { ok: true, challengeId: record.id, code, expiresAt: record.expiresAt };
}

export type VerifyOtpError = "NOT_FOUND" | "EXPIRED" | "CONSUMED" | "TOO_MANY_ATTEMPTS" | "INVALID_CODE";

export interface VerifyOtpResult {
  ok: boolean;
  record?: OtpRecord;
  error?: VerifyOtpError;
  attemptsLeft?: number;
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
  store: OtpStore;
  now?: Date;
}): Promise<VerifyOtpResult> {
  const now = input.now ?? new Date();
  const record = await input.store.findById(input.challengeId);
  if (!record) return { ok: false, error: "NOT_FOUND" };
  if (record.consumedAt) return { ok: false, error: "CONSUMED" };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "EXPIRED" };
  if (record.attempts >= record.maxAttempts) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  const candidate = hashWithSalt(input.code.trim(), record.salt);
  if (!safeEquals(candidate, record.codeHash)) {
    await input.store.incrementAttempts(record.id);
    const attemptsLeft = Math.max(0, record.maxAttempts - (record.attempts + 1));
    return { ok: false, error: "INVALID_CODE", attemptsLeft };
  }

  await input.store.consume(record.id);
  return { ok: true, record };
}

// ---------------------------------------------------------------------------
// Normalisation des destinations (§7)
// ---------------------------------------------------------------------------

/** Indicatifs des marches cibles, dans l'ordre de deploiement du §4. */
export const DIAL_CODES: Record<string, string> = {
  TG: "+228",
  BJ: "+229",
  CI: "+225",
  CM: "+237",
  SN: "+221",
  CD: "+243",
  BF: "+226",
  GN: "+224",
  CG: "+242",
  GA: "+241",
  ML: "+223",
  NE: "+227",
  FR: "+33",
  BE: "+32",
  CA: "+1",
  US: "+1",
};

/**
 * Met un numero au format E.164, en appliquant les regles de numerotation du
 * pays (src/lib/geo/phone.ts). Rend null si le numero est invalide ;
 * `validatePhone` donne le motif detaille quand on veut l'afficher.
 */
export function normalizePhone(raw: string, countryCode: string): string | null {
  const result = validatePhone(raw, countryCode);
  return result.ok ? result.e164 : null;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  // Volontairement simple : la verification reelle est l'envoi du code.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** Masque une destination pour l'affichage (« +228 •• •• 34 56 »). */
export function maskDestination(channel: OtpChannel, destination: string): string {
  if (channel === "EMAIL") {
    const [local = "", domain = ""] = destination.split("@");
    const head = local.slice(0, 2);
    return `${head}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  const tail = destination.slice(-4);
  return `${destination.slice(0, 4)} •• •• ${tail.slice(0, 2)} ${tail.slice(2)}`;
}
