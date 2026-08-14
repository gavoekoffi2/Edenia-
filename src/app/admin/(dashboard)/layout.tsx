import Link from "next/link";
import { redirect } from "next/navigation";
import { adminGate } from "@/lib/admin/service";
import { ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { sectionsFor } from "@/lib/admin/sections";
import { Logo } from "@/components/brand";
import { DevModeBanner } from "@/components/dev-mode-banner";
import { AdminSignOut } from "@/components/admin-signout";
import { monetizationLabel } from "@/lib/config/monetization";

export const metadata = { title: "Administration EDENIA", robots: { index: false, follow: false } };

/**
 * §36, §51 — back-office.
 *
 * La navigation est filtrée par permission : un agent de vérification ne voit
 * pas le lien vers la modération. Cacher un lien n'est pas une sécurité —
 * chaque page revalide via `requireAdminPage` — mais c'est la traduction
 * visible du §36 : « Il ne doit pas avoir accès aux fonctions inutiles. »
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await adminGate();

  if (gate.state === "ANONYMOUS") redirect("/connexion?suivant=/admin");
  if (gate.state === "NOT_STAFF" || gate.state === "NO_ADMIN_RECORD") redirect("/app/decouvrir");
  if (gate.state === "DISABLED") redirect("/admin/desactive");
  if (gate.state === "SETUP_REQUIRED") redirect("/admin/configuration-requise");
  if (gate.state !== "READY") redirect("/admin/connexion");

  const { context } = gate;
  const links = sectionsFor(context.role);

  return (
    <div className="min-h-screen">
      <DevModeBanner />
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <span className="e-chip">{ROLE_LABEL[context.role as Role] ?? context.role}</span>
            <span className="text-xs hidden sm:inline" style={{ color: "var(--fg-muted)" }}>
              {context.displayName}
            </span>
          </div>
          <AdminSignOut />
        </div>
        <nav
          className="mx-auto max-w-6xl px-4 pb-2 flex gap-3 text-sm overflow-x-auto"
          aria-label="Sections du back-office"
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {context.recoveryCodesLeft <= 2 && (
        <p className="mx-auto max-w-6xl px-4 pt-3 text-xs" style={{ color: "var(--color-danger-500)" }}>
          Il ne vous reste que {context.recoveryCodesLeft} code(s) de récupération. Demandez une
          réinitialisation à l&apos;administrateur principal avant d&apos;être bloqué.
        </p>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs" style={{ color: "var(--fg-muted)" }}>
        Mode économique : {monetizationLabel()}. Session d&apos;administration limitée à 8 heures.
      </footer>
    </div>
  );
}
