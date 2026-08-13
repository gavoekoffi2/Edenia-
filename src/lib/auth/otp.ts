import { randomInt } from "node:crypto";
import { hashWithSalt, newSalt, safeEquals } from "@/lib/crypto/field";

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
/** Nombre de demandes autorisees par destination et par heure. */
export const OTP_MAX_CHALLENGES_PER_HOUR = 3;

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

/** Genere un code numerique a partir d'une source cryptographique. */
export function generateCode(length = OTP_LENGTH): string {
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
 * Met un numero au format E.164.
 *
 * Les utilisateurs saisissent souvent leur numero en format local (« 90 12 34 56 »).
 * Refuser cette saisie serait une friction inutile (§60) : on complete avec
 * l'indicatif du pays choisi.
 */
export function normalizePhone(raw: string, countryCode: string): string | null {
  const dial = DIAL_CODES[countryCode.toUpperCase()];
  if (!dial) return null;

  const cleaned = raw.replace(/[\s.\-()]/g, "");
  if (!cleaned) return null;

  let digits: string;
  if (cleaned.startsWith("+")) {
    if (!cleaned.startsWith(dial)) return null; // incoherence pays / indicatif
    digits = cleaned.slice(dial.length);
  } else if (cleaned.startsWith("00")) {
    const withPlus = `+${cleaned.slice(2)}`;
    if (!withPlus.startsWith(dial)) return null;
    digits = withPlus.slice(dial.length);
  } else {
    digits = cleaned.replace(/^0+/, "");
  }

  if (!/^\d{6,12}$/.test(digits)) return null;
  return `${dial}${digits}`;
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
