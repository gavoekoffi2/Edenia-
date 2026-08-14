import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, isStaff, ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { Logo } from "@/components/brand";
import { DevModeBanner } from "@/components/dev-mode-banner";

export const metadata = { title: "Administration EDENIA", robots: { index: false, follow: false } };

/**
 * §36, §51 — back-office.
 *
 * La navigation elle-meme est filtree par permission : un agent de verification
 * ne voit pas le lien vers la moderation. Cacher un lien n'est pas une securite
 * (chaque page revalide), mais c'est la traduction visible du principe du §36 :
 * « Il ne doit pas avoir acces aux fonctions inutiles. »
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!isStaff(user.role)) redirect("/app/decouvrir");

  const links = [
    { href: "/admin", label: "Tableau de bord", permission: "analytics.read" as const },
    { href: "/admin/verification", label: "Vérification", permission: "verification.read" as const },
    { href: "/admin/moderation", label: "Modération", permission: "reports.read" as const },
    { href: "/admin/services", label: "Services", permission: "analytics.read" as const },
  ].filter((link) => can(user.role, link.permission));

  return (
    <div className="min-h-screen">
      <DevModeBanner />
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo size={24} />
            <span className="e-chip">{ROLE_LABEL[user.role as Role] ?? user.role}</span>
          </div>
          <nav className="flex gap-3 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/app/decouvrir" style={{ color: "var(--fg-muted)" }}>
              Quitter
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
