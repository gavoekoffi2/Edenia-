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
  "donations.read",
  // Pilotage
  "analytics.read",
  "audit.read",
  "admins.manage",
  "settings.read",
  "settings.write",
  "countries.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "USER",
  "SUPPORT",
  "ANALYST",
  "VERIFIER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * `VERIFICATION_AGENT` etait le code utilise avant le sprint final. Il reste
 * accepte en lecture pour ne pas invalider les comptes deja crees : renommer un
 * role ne doit pas verrouiller la personne qui le porte.
 */
const ROLE_ALIASES: Record<string, Role> = {
  VERIFICATION_AGENT: "VERIFIER",
};

export function normalizeRole(role: string): Role | null {
  const canonical = ROLE_ALIASES[role] ?? role;
  return (ROLES as readonly string[]).includes(canonical) ? (canonical as Role) : null;
}

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Membre",
  SUPPORT: "Support",
  ANALYST: "Analyste",
  VERIFIER: "Agent de vérification",
  MODERATOR: "Modérateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Administrateur principal",
};

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [],

  SUPPORT: ["users.read", "reports.read", "verification.read", "analytics.read"],

  ANALYST: ["analytics.read"],

  // §36 : perimetre etroit et assume.
  VERIFIER: [
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
    "donations.read",
    "analytics.read",
    "audit.read",
    "settings.read",
    "countries.manage",
  ],

  SUPER_ADMIN: [...PERMISSIONS],
};

export function permissionsFor(role: string): readonly Permission[] {
  const canonical = normalizeRole(role);
  return canonical ? ROLE_PERMISSIONS[canonical] : [];
}

export function can(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function canAll(role: string, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

export function isStaff(role: string): boolean {
  const canonical = normalizeRole(role);
  return canonical !== null && canonical !== "USER";
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
