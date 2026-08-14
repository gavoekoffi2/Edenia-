import Link from "next/link";

export const metadata = { title: "Compte désactivé", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="e-card p-6">
        <h1 className="e-display text-xl">Accès interne désactivé</h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Votre compte administrateur a été désactivé. Votre compte membre, lui, reste utilisable
          normalement.
        </p>
        <Link href="/app/decouvrir" className="e-btn e-btn-secondary mt-4">
          Retour à l&apos;application
        </Link>
      </div>
    </div>
  );
}
