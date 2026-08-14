import Link from "next/link";

export const metadata = { title: "Accès refusé", robots: { index: false, follow: false } };

/**
 * §36 — « Il ne doit pas avoir accès aux fonctions inutiles. »
 * L'écran le dit sans dramatiser : ce n'est pas une faute, c'est un périmètre.
 */
export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="e-card p-6">
        <h1 className="e-display text-xl">Hors de votre périmètre</h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Votre rôle ne donne pas accès à cette section. Les droits sont attribués au plus juste :
          chacun voit ce dont il a besoin pour son travail, et rien de plus.
        </p>
        <Link href="/admin" className="e-btn e-btn-secondary mt-4">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
