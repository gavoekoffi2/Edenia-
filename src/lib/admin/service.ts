import { cache } from "react";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertCan, can, isStaff, type Permission } from "@/lib/auth/rbac";
import { decryptField, encryptField, pseudonymize } from "@/lib/crypto/field";
import { checkPasswordStrength, hashPassword, verifyPassword } from "./password";
import { hashInvitationToken, issueInvitation, type CreatedInvitation } from "./invitations";
import {
  adminFingerprint,
  clearAdminCookie,
  createAdminToken,
  readAdminSession,
  setAdminCookie,
} from "./session";
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "./totp";

/**
 * §9, §35, §36 — le back-office.
 *
 * Trois principes gouvernent ce fichier :
 *  - aucun compte par defaut, aucun mot de passe universel, aucun endpoint de
 *    contournement. Le premier administrateur est cree par une commande locale
 *    qui produit un lien a usage unique ;
 *  - la permission est verifiee a chaque appel, jamais deduite d'un ecran ;
 *  - toute action sensible laisse une trace nominative dans AdminAction, et une
 *    trace pseudonymisee dans AuditLog.
 */

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60_000;

export interface AdminContext {
  adminId: string;
  userId: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  /** Nombre de codes de recuperation encore utilisables. */
  recoveryCodesLeft: number;
}

/** Etat de la session d'administration, sans effet de bord. */
export type AdminGate =
  | { state: "ANONYMOUS" }
  | { state: "NOT_STAFF" }
  | { state: "NO_ADMIN_RECORD" }
  | { state: "DISABLED" }
  | { state: "SETUP_REQUIRED"; adminId: string }
  | { state: "ELEVATION_REQUIRED"; adminId: string; displayName: string }
  | { state: "READY"; context: AdminContext };

export const adminGate = cache(async (): Promise<AdminGate> => {
  const user = await getCurrentUser();
  if (!user) return { state: "ANONYMOUS" };
  if (!isStaff(user.role)) return { state: "NOT_STAFF" };

  const admin = await prisma.adminUser.findUnique({ where: { userId: user.id } });
  if (!admin) return { state: "NO_ADMIN_RECORD" };
  if (!admin.isActive) return { state: "DISABLED" };

  // Un compte sans mot de passe ou sans MFA ne peut pas travailler : il doit
  // d'abord terminer son inscription via le lien d'invitation.
  if (!admin.passwordHash || !admin.mfaSecretEnc || !admin.mfaEnabledAt) {
    return { state: "SETUP_REQUIRED", adminId: admin.id };
  }

  const session = await readAdminSession();
  const expected = adminFingerprint(admin);

  if (!session || session.sub !== admin.id || session.uid !== user.id || session.fp !== expected) {
    return { state: "ELEVATION_REQUIRED", adminId: admin.id, displayName: admin.displayName };
  }

  return {
    state: "READY",
    context: {
      adminId: admin.id,
      userId: user.id,
      displayName: admin.displayName,
      role: admin.roleCode,
      mfaEnabled: admin.mfaEnabledAt !== null,
      recoveryCodesLeft: parseHashes(admin.mfaRecoveryHashes).length,
    },
  };
});

export class AdminElevationRequired extends Error {
  constructor(readonly gate: AdminGate) {
    super("Élévation administrateur requise.");
    this.name = "AdminElevationRequired";
  }
}

/**
 * Porte d'entree de toute page et de toute route du back-office.
 * Le role est verifie en base, pas dans le jeton : retirer un role prend effet
 * immediatement.
 */
export async function requireAdmin(permission: Permission): Promise<AdminContext> {
  const gate = await adminGate();
  if (gate.state !== "READY") throw new AdminElevationRequired(gate);
  assertCan(gate.context.role, permission);
  return gate.context;
}

export function adminCan(context: AdminContext, permission: Permission): boolean {
  return can(context.role, permission);
}

function parseHashes(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// --- Elevation --------------------------------------------------------------

export type ElevateResult =
  | { ok: true; context: AdminContext }
  | { ok: false; error: string; locked?: boolean };

/**
 * Verifie mot de passe **et** second facteur, puis ouvre la session
 * d'administration.
 *
 * Le message d'erreur est volontairement identique pour un mot de passe faux et
 * un code TOTP faux : distinguer les deux indiquerait a un attaquant qu'il a
 * trouve le mot de passe.
 */
export async function elevate(input: {
  password: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<ElevateResult> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) return { ok: false, error: "Accès refusé." };

  const admin = await prisma.adminUser.findUnique({ where: { userId: user.id } });
  if (!admin || !admin.isActive) return { ok: false, error: "Accès refusé." };

  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Compte verrouillé. Réessayez dans ${minutes} minute(s).`, locked: true };
  }

  if (!admin.passwordHash || !admin.mfaSecretEnc) {
    return { ok: false, error: "Ce compte n'a pas terminé sa configuration." };
  }

  const passwordOk = await verifyPassword(input.password, admin.passwordHash);

  let secondFactorOk = false;
  let usedRecovery = false;
  let remainingHashes = parseHashes(admin.mfaRecoveryHashes);

  if (passwordOk) {
    const secret = decryptField(admin.mfaSecretEnc);
    secondFactorOk = verifyTotp(secret, input.code);

    // Un code a 6 chiffres n'est jamais un code de recuperation : on ne tente
    // la liste de secours que si le format correspond.
    if (!secondFactorOk && /^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/.test(input.code.trim())) {
      const consumed = consumeRecoveryCode(remainingHashes, input.code.trim());
      if (consumed.ok) {
        secondFactorOk = true;
        usedRecovery = true;
        remainingHashes = consumed.remaining;
      }
    }
  }

  if (!passwordOk || !secondFactorOk) {
    const failed = admin.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_DURATION_MS) : admin.lockedUntil,
      },
    });
    await audit({
      event: "ADMIN_ELEVATION_FAILED",
      actorType: "ADMIN",
      actorRef: pseudonymize(admin.id),
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { locked: lock },
    });
    return {
      ok: false,
      error: lock
        ? "Trop de tentatives. Compte verrouillé 15 minutes."
        : "Identifiants incorrects.",
      locked: lock,
    };
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(usedRecovery ? { mfaRecoveryHashes: JSON.stringify(remainingHashes) } : {}),
    },
  });

  const token = await createAdminToken({
    sub: admin.id,
    uid: user.id,
    fp: adminFingerprint(admin),
  });
  await setAdminCookie(token);

  await audit({
    event: usedRecovery ? "ADMIN_ELEVATION_RECOVERY" : "ADMIN_ELEVATION",
    actorType: "ADMIN",
    actorRef: pseudonymize(admin.id),
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: usedRecovery ? { recoveryCodesLeft: remainingHashes.length } : undefined,
  });

  return {
    ok: true,
    context: {
      adminId: admin.id,
      userId: user.id,
      displayName: admin.displayName,
      role: admin.roleCode,
      mfaEnabled: true,
      recoveryCodesLeft: remainingHashes.length,
    },
  };
}

export async function endElevation(): Promise<void> {
  await clearAdminCookie();
}

// --- Invitations ------------------------------------------------------------

/**
 * §36 — creation d'un sous-compte administrateur, sans acces a la base.
 *
 * Le createur ne choisit pas le mot de passe et ne le voit jamais : il produit
 * un lien a usage unique, valable 72 heures, au bout duquel l'interesse definit
 * son secret et enrole son second facteur.
 */
export async function inviteAdmin(input: {
  actor: AdminContext;
  userId: string;
  displayName: string;
  roleCode: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ ok: true; invitation: CreatedInvitation } | { ok: false; error: string }> {
  assertCan(input.actor.role, "admins.manage");

  // Un administrateur ne peut pas creer plus puissant que lui : sans cette
  // regle, « admins.manage » equivaudrait a SUPER_ADMIN pour tout le monde.
  if (input.roleCode === "SUPER_ADMIN" && input.actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul un administrateur principal peut en créer un autre." };
  }

  const role = await prisma.adminRole.findUnique({ where: { code: input.roleCode } });
  if (!role) return { ok: false, error: "Rôle inconnu." };

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true } });
  if (!user) return { ok: false, error: "Ce compte membre n'existe pas." };
  if (user.status === "BANNED" || user.status === "DELETED") {
    return { ok: false, error: "Ce compte ne peut pas recevoir de rôle interne." };
  }

  const admin = await prisma.adminUser.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      displayName: input.displayName.trim().slice(0, 80),
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      roleCode: input.roleCode,
      isActive: true,
      createdById: input.actor.adminId,
    },
    update: {
      displayName: input.displayName.trim().slice(0, 80),
      roleCode: input.roleCode,
      isActive: true,
    },
  });

  // Le role interne vit sur User : c'est lui que lit la session.
  await prisma.user.update({ where: { id: input.userId }, data: { role: input.roleCode } });

  const invitation = await issueInvitation(admin.id, input.actor.adminId);

  await recordAdminAction(input.actor, {
    action: "ADMIN_INVITED",
    targetType: "ADMIN_USER",
    targetId: admin.id,
    metadata: { roleCode: input.roleCode },
  });

  return { ok: true, invitation };
}

export interface InvitationTarget {
  adminUserId: string;
  displayName: string;
  roleCode: string;
  userId: string;
  hasPassword: boolean;
  hasMfa: boolean;
}

export async function readInvitation(token: string): Promise<InvitationTarget | null> {
  const invitation = await prisma.adminInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { adminUser: true },
  });
  if (!invitation) return null;
  if (invitation.consumedAt) return null;
  if (invitation.expiresAt.getTime() < Date.now()) return null;
  if (!invitation.adminUser.isActive) return null;

  return {
    adminUserId: invitation.adminUser.id,
    displayName: invitation.adminUser.displayName,
    roleCode: invitation.adminUser.roleCode,
    userId: invitation.adminUser.userId,
    hasPassword: invitation.adminUser.passwordHash !== null,
    hasMfa: invitation.adminUser.mfaEnabledAt !== null,
  };
}

export interface EnrollmentDraft {
  secret: string;
  otpauthUri: string;
}

/**
 * Finalise un compte : mot de passe + second facteur, en une seule operation.
 *
 * Volontairement atomique : un compte qui aurait un mot de passe mais pas de
 * MFA serait un compte a un seul facteur, et personne ne penserait a revenir
 * finir la configuration.
 */
export async function completeInvitation(input: {
  token: string;
  password: string;
  passwordConfirm: string;
  totpSecret: string;
  totpCode: string;
}): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string; problems?: string[] }> {
  const target = await readInvitation(input.token);
  if (!target) return { ok: false, error: "Ce lien est invalide, expiré ou déjà utilisé." };

  if (input.password !== input.passwordConfirm) {
    return { ok: false, error: "Les deux mots de passe ne correspondent pas." };
  }

  const strength = checkPasswordStrength(input.password, [target.displayName]);
  if (!strength.ok) {
    return { ok: false, error: "Mot de passe trop faible.", problems: strength.problems };
  }

  if (!verifyTotp(input.totpSecret, input.totpCode)) {
    return { ok: false, error: "Le code à 6 chiffres ne correspond pas. Vérifiez l'heure de votre téléphone." };
  }

  const recoveryCodes = generateRecoveryCodes();
  const now = new Date();

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: target.adminUserId },
      data: {
        passwordHash: await hashPassword(input.password),
        passwordSetAt: now,
        mfaSecretEnc: encryptField(input.totpSecret),
        mfaEnabledAt: now,
        mfaRecoveryHashes: JSON.stringify(recoveryCodes.map(hashRecoveryCode)),
        failedLogins: 0,
        lockedUntil: null,
      },
    }),
    prisma.adminInvitation.updateMany({
      where: { adminUserId: target.adminUserId, consumedAt: null },
      data: { consumedAt: now },
    }),
  ]);

  await audit({
    event: "ADMIN_SETUP_COMPLETED",
    actorType: "ADMIN",
    actorRef: pseudonymize(target.adminUserId),
    metadata: { roleCode: target.roleCode },
  });

  return { ok: true, recoveryCodes };
}

/** Prepare un secret TOTP a afficher — jamais persiste avant validation. */
export function newEnrollment(account: string): EnrollmentDraft {
  const secret = generateTotpSecret();
  return { secret, otpauthUri: otpauthUri(secret, account) };
}

// --- Gestion des comptes internes -------------------------------------------

export async function setAdminActive(
  actor: AdminContext,
  adminUserId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  assertCan(actor.role, "admins.manage");
  if (adminUserId === actor.adminId) return { ok: false, error: "Vous ne pouvez pas vous désactiver vous-même." };

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, error: "Compte introuvable." };
  if (target.roleCode === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Action réservée à l'administrateur principal." };
  }
  if (target.roleCode === "SUPER_ADMIN" && !isActive) {
    const others = await prisma.adminUser.count({
      where: { roleCode: "SUPER_ADMIN", isActive: true, id: { not: adminUserId } },
    });
    // Se retrouver sans administrateur principal actif rendrait la plateforme
    // ingerable : la seule sortie serait un acces direct a la base.
    if (others === 0) return { ok: false, error: "Il doit rester au moins un administrateur principal actif." };
  }

  await prisma.adminUser.update({ where: { id: adminUserId }, data: { isActive } });
  await recordAdminAction(actor, {
    action: isActive ? "ADMIN_ENABLED" : "ADMIN_DISABLED",
    targetType: "ADMIN_USER",
    targetId: adminUserId,
  });
  return { ok: true };
}

/**
 * §9 — reinitialisation du second facteur par un administrateur principal.
 *
 * Elle ne devoile aucun secret : elle efface le mot de passe et le MFA, puis
 * emet un nouveau lien de configuration. Le detenteur du compte refait le
 * parcours complet. C'est la seule procedure de recuperation, et elle laisse
 * une trace.
 */
export async function resetAdminCredentials(
  actor: AdminContext,
  adminUserId: string,
): Promise<{ ok: true; invitation: CreatedInvitation } | { ok: false; error: string }> {
  assertCan(actor.role, "admins.manage");

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, error: "Compte introuvable." };
  if (target.roleCode === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Action réservée à l'administrateur principal." };
  }

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: {
      passwordHash: null,
      passwordSetAt: null,
      mfaSecretEnc: null,
      mfaEnabledAt: null,
      mfaRecoveryHashes: "[]",
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  const invitation = await issueInvitation(adminUserId, actor.adminId);

  await recordAdminAction(actor, {
    action: "ADMIN_CREDENTIALS_RESET",
    targetType: "ADMIN_USER",
    targetId: adminUserId,
    reason: "Réinitialisation du mot de passe et du second facteur.",
  });

  return { ok: true, invitation };
}

export async function changeAdminRole(
  actor: AdminContext,
  adminUserId: string,
  roleCode: string,
): Promise<{ ok: boolean; error?: string }> {
  assertCan(actor.role, "admins.manage");
  if (adminUserId === actor.adminId) return { ok: false, error: "Vous ne pouvez pas changer votre propre rôle." };
  if (roleCode === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul un administrateur principal peut en désigner un autre." };
  }

  const role = await prisma.adminRole.findUnique({ where: { code: roleCode } });
  if (!role) return { ok: false, error: "Rôle inconnu." };

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { ok: false, error: "Compte introuvable." };
  if (target.roleCode === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Action réservée à l'administrateur principal." };
  }

  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: adminUserId }, data: { roleCode } }),
    prisma.user.update({ where: { id: target.userId }, data: { role: roleCode } }),
  ]);

  await recordAdminAction(actor, {
    action: "ADMIN_ROLE_CHANGED",
    targetType: "ADMIN_USER",
    targetId: adminUserId,
    metadata: { from: target.roleCode, to: roleCode },
  });

  return { ok: true };
}

// --- Journal ----------------------------------------------------------------

export async function recordAdminAction(
  actor: AdminContext,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.adminAction
    .create({
      data: {
        adminId: actor.adminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
    .catch((error) => console.error("Journalisation admin impossible", error));

  await audit({
    event: input.action,
    actorType: "ADMIN",
    actorRef: pseudonymize(actor.adminId),
    targetRef: pseudonymize(input.targetId),
    metadata: input.metadata,
  });
}
