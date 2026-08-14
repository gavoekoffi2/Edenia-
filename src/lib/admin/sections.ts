import { can, type Permission } from "@/lib/auth/rbac";

/**
 * Sections du back-office, dans l'ordre de la navigation.
 *
 * Une seule liste, partagee par le layout (filtrage des liens) et par la racine
 * `/admin` (choix de la page d'accueil selon le role). Sans cela, un agent de
 * verification arrivant sur `/admin` verrait un refus alors qu'il a bien du
 * travail a faire, deux liens plus loin.
 */
export interface AdminSection {
  href: string;
  label: string;
  permission: Permission;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { href: "/admin", label: "Tableau de bord", permission: "analytics.read" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", permission: "users.read" },
  { href: "/admin/profils", label: "Profils", permission: "photos.moderate" },
  { href: "/admin/verification", label: "Vérifications", permission: "verification.read" },
  { href: "/admin/moderation", label: "Signalements", permission: "reports.read" },
  { href: "/admin/dons", label: "Dons", permission: "donations.read" },
  { href: "/admin/paiements", label: "Paiements", permission: "payments.read" },
  { href: "/admin/pays", label: "Pays", permission: "countries.manage" },
  { href: "/admin/administrateurs", label: "Administrateurs", permission: "admins.manage" },
  { href: "/admin/journal", label: "Journal d'audit", permission: "audit.read" },
  { href: "/admin/parametres", label: "Paramètres", permission: "settings.read" },
  { href: "/admin/services", label: "Services", permission: "analytics.read" },
];

export function sectionsFor(role: string): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => can(role, section.permission));
}

/** Premiere section accessible — page d'accueil naturelle du role. */
export function landingSection(role: string): string {
  return sectionsFor(role)[0]?.href ?? "/admin/refuse";
}
