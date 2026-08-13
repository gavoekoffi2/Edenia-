/**
 * RBAC (§36, §50, §51).
 *
 * Principe : **refus par defaut**. Une permission absente de la liste d'un role
 * est refusee, sans exception ni heritage implicite.
 *
 * Le §36 insiste sur un point precis : l'agent de verification « ne doit pas
 * avoir acces aux fonctions inutiles ». Son role est donc volontairement etroit —
 * il voit les dossiers de verification, pas les conversations ni les paiements.
 */

export const PERMISSIONS = [
  // Utilisateurs
  "users.read",
  "users.suspend",
  "users.ban",
  "users.delete",
  "users.read_sensitive", // coordonnees, journal complet
  // Moderation
  "reports.read",
  "reports.action",
  "messages.read_flagged",
  "photos.moderate",
  // Verification
  "verification.read",
  "verification.decide",
  "verification.request_info",
  "verification.read_documents",
  "church.manage",
  // Contenu
  "content.write",
  "events.manage",
  // Finance
  "payments.read",
  "payments.refund",
  "plans.manage",
  // Pilotage
  "analytics.read",
  "audit.read",
  "admins.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "USER",
  "SUPPORT",
  "ANALYST",
  "VERIFICATION_AGENT",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Membre",
  SUPPORT: "Support",
  ANALYST: "Analyste",
  VERIFICATION_AGENT: "Agent de vérification",
  MODERATOR: "Modérateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Administrateur principal",
};

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [],

  SUPPORT: ["users.read", "reports.read", "verification.read"],

  ANALYST: ["analytics.read"],

  // §36 : perimetre etroit et assume.
  VERIFICATION_AGENT: [
    "users.read",
    "verification.read",
    "verification.decide",
    "verification.request_info",
    "verification.read_documents",
    "church.manage",
  ],

  MODERATOR: [
    "users.read",
    "users.suspend",
    "reports.read",
    "reports.action",
    "messages.read_flagged",
    "photos.moderate",
    "verification.read",
  ],

  ADMIN: [
    "users.read",
    "users.suspend",
    "users.ban",
    "users.read_sensitive",
    "reports.read",
    "reports.action",
    "messages.read_flagged",
    "photos.moderate",
    "verification.read",
    "verification.decide",
    "verification.request_info",
    "church.manage",
    "content.write",
    "events.manage",
    "payments.read",
    "analytics.read",
    "audit.read",
  ],

  SUPER_ADMIN: [...PERMISSIONS],
};

export function permissionsFor(role: string): readonly Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function can(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function canAll(role: string, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

export function isStaff(role: string): boolean {
  return role !== "USER" && (ROLES as readonly string[]).includes(role);
}

/** §50 : MFA obligatoire pour tout role interne. */
export function requiresMfa(role: string): boolean {
  return isStaff(role);
}

export class ForbiddenError extends Error {
  constructor(readonly permission: Permission) {
    super(`Permission requise : ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: string, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}
