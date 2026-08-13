import { prisma } from "@/lib/db/client";
import { hashIp, pseudonymize } from "@/lib/crypto/field";
import { getEmailProvider, getSmsProvider, TEMPLATES } from "@/lib/notifications";
import { isDev } from "@/lib/config/env";
import {
  maskDestination,
  normalizeEmail,
  normalizePhone,
  requestOtp,
  verifyOtp,
  type OtpChannel,
  type OtpPurpose,
  type OtpRecord,
  type OtpStore,
} from "./otp";
import { createSessionToken } from "./session";

/** Adaptateur Prisma de l'interface `OtpStore` (le module OTP reste pur). */
const store: OtpStore = {
  async create(record) {
    const created = await prisma.otpChallenge.create({ data: record });
    return created as OtpRecord;
  },
  async findById(id) {
    const found = await prisma.otpChallenge.findUnique({ where: { id } });
    return (found as OtpRecord | null) ?? null;
  },
  async countRecent(destination, since) {
    return prisma.otpChallenge.count({ where: { destination, createdAt: { gte: since } } });
  },
  async incrementAttempts(id) {
    await prisma.otpChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  },
  async consume(id) {
    await prisma.otpChallenge.update({ where: { id }, data: { consumedAt: new Date() } });
  },
};

export interface StartAuthInput {
  channel: OtpChannel;
  rawDestination: string;
  /** Requis pour un telephone : permet la saisie au format local (§7). */
  countryCode?: string;
  purpose?: OtpPurpose;
  ip?: string | null;
}

export interface StartAuthResult {
  ok: boolean;
  challengeId?: string;
  maskedDestination?: string;
  error?: string;
  /** Uniquement en developpement : evite d'avoir besoin d'un vrai SMS. */
  devCode?: string;
}

export async function startAuth(input: StartAuthInput): Promise<StartAuthResult> {
  const destination =
    input.channel === "PHONE"
      ? normalizePhone(input.rawDestination, input.countryCode ?? "TG")
      : normalizeEmail(input.rawDestination);

  if (!destination) {
    return {
      ok: false,
      error:
        input.channel === "PHONE"
          ? "Ce numéro ne semble pas valide. Vérifiez le pays et les chiffres saisis."
          : "Cette adresse e-mail ne semble pas valide.",
    };
  }

  const result = await requestOtp({ channel: input.channel, destination, purpose: input.purpose ?? "SIGNUP", store });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "RATE_LIMITED"
          ? "Trop de demandes pour ce contact. Réessayez dans une heure."
          : "Demande impossible pour le moment.",
    };
  }

  // L'envoi ne doit pas faire echouer la demande : l'utilisateur peut redemander
  // un code, et un echec d'operateur ne doit pas ressembler a un bug d'EDENIA.
  try {
    if (input.channel === "PHONE") {
      await getSmsProvider().send(destination, TEMPLATES.otpSms(result.code!));
    } else {
      await getEmailProvider().send(destination, TEMPLATES.otpEmailSubject(), TEMPLATES.otpEmailBody(result.code!));
    }
  } catch (error) {
    console.error("Envoi du code impossible", error);
  }

  await audit({
    event: "AUTH_OTP_REQUESTED",
    actorType: "SYSTEM",
    actorRef: pseudonymize(destination),
    ip: input.ip,
  });

  return {
    ok: true,
    challengeId: result.challengeId,
    maskedDestination: maskDestination(input.channel, destination),
    devCode: isDev ? result.code : undefined,
  };
}

export interface CompleteAuthResult {
  ok: boolean;
  token?: string;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
  attemptsLeft?: number;
}

export async function completeAuth(challengeId: string, code: string, ip?: string | null): Promise<CompleteAuthResult> {
  const result = await verifyOtp({ challengeId, code, store });

  if (!result.ok || !result.record) {
    const messages: Record<string, string> = {
      NOT_FOUND: "Cette demande n'existe plus. Recommencez.",
      EXPIRED: "Ce code a expiré. Demandez-en un nouveau.",
      CONSUMED: "Ce code a déjà été utilisé.",
      TOO_MANY_ATTEMPTS: "Trop de tentatives. Demandez un nouveau code.",
      INVALID_CODE: "Code incorrect.",
    };
    return {
      ok: false,
      error: messages[result.error ?? ""] ?? "Vérification impossible.",
      attemptsLeft: result.attemptsLeft,
    };
  }

  const { channel, destination } = result.record;
  const isPhone = channel === "PHONE";

  const existing = await prisma.user.findUnique({
    where: isPhone ? { phone: destination } : { email: destination },
    select: { id: true, sessionVersion: true, role: true, status: true },
  });

  if (existing) {
    if (existing.status === "BANNED") {
      return { ok: false, error: "Ce compte a été fermé. Contactez support@edenia.app." };
    }
    // §8 : on marque le canal comme verifie, meme si le compte existait deja.
    await prisma.user.update({
      where: { id: existing.id },
      data: isPhone ? { phoneVerified: true } : { emailVerified: true },
    });

    const token = await createSessionToken({
      sub: existing.id,
      sv: existing.sessionVersion,
      role: existing.role,
    });

    await audit({ event: "AUTH_LOGIN", actorType: "USER", actorRef: pseudonymize(existing.id), ip });
    return { ok: true, token, userId: existing.id, isNewUser: false };
  }

  const created = await prisma.user.create({
    data: isPhone
      ? { phone: destination, phoneVerified: true, phoneCountry: guessCountry(destination) }
      : { email: destination, emailVerified: true },
    select: { id: true, sessionVersion: true, role: true },
  });

  await prisma.contactMethod.create({
    data: {
      userId: created.id,
      kind: channel,
      value: destination,
      verified: true,
      verifiedAt: new Date(),
      isPrimary: true,
    },
  });

  // §47 : consentements de base, horodates et versionnes.
  await prisma.consent.createMany({
    data: [
      { userId: created.id, purpose: "TERMS", granted: true, version: "2026-01" },
      { userId: created.id, purpose: "PRIVACY", granted: true, version: "2026-01" },
    ],
  });

  const token = await createSessionToken({ sub: created.id, sv: created.sessionVersion, role: created.role });
  await audit({ event: "AUTH_SIGNUP", actorType: "USER", actorRef: pseudonymize(created.id), ip });

  return { ok: true, token, userId: created.id, isNewUser: true };
}

function guessCountry(phone: string): string | null {
  const entries: Array<[string, string]> = [
    ["+228", "TG"], ["+229", "BJ"], ["+225", "CI"], ["+237", "CM"], ["+221", "SN"],
    ["+243", "CD"], ["+226", "BF"], ["+224", "GN"], ["+242", "CG"], ["+241", "GA"],
    ["+223", "ML"], ["+227", "NE"], ["+33", "FR"], ["+32", "BE"], ["+1", "CA"],
  ];
  for (const [dial, code] of entries) {
    if (phone.startsWith(dial)) return code;
  }
  return null;
}

export interface AuditInput {
  event: string;
  actorType: "USER" | "ADMIN" | "SYSTEM";
  actorRef: string;
  targetRef?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** §47 : journal d'audit pseudonymise. Ne doit jamais faire echouer une action metier. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: input.event,
        actorType: input.actorType,
        actorRef: input.actorRef,
        targetRef: input.targetRef ?? null,
        ipHash: hashIp(input.ip),
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Journalisation impossible", error);
  }
}
