import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/auth/rbac";
import { adminGate, type AdminContext } from "./service";

/**
 * Garde des **pages** du back-office.
 *
 * Les routes d'API lèvent une erreur (traduite en 401/403 par `handler`) ; une
 * page, elle, doit conduire quelque part. D'où ce module séparé : même
 * décision, présentation différente.
 *
 * Chaque page appelle cette fonction. Le filtrage de la navigation dans le
 * layout est un confort, pas une protection — une URL tapée à la main passe
 * par ici de toute façon.
 */
export async function requireAdminPage(permission: Permission): Promise<AdminContext> {
  const gate = await adminGate();

  switch (gate.state) {
    case "ANONYMOUS":
      redirect("/connexion?suivant=/admin");
      break;
    case "NOT_STAFF":
    case "NO_ADMIN_RECORD":
      redirect("/app/decouvrir");
      break;
    case "DISABLED":
      redirect("/admin/desactive");
      break;
    case "SETUP_REQUIRED":
      redirect("/admin/configuration-requise");
      break;
    case "ELEVATION_REQUIRED":
      redirect("/admin/connexion");
      break;
    case "READY":
      if (!can(gate.context.role, permission)) redirect("/admin/refuse");
      return gate.context;
  }

  // `redirect()` interrompt le rendu : ce point n'est jamais atteint.
  throw new Error("unreachable");
}
