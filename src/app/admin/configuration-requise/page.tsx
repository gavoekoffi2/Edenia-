export const metadata = { title: "Configuration requise", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="e-card p-6">
        <h1 className="e-display text-xl">Compte non configuré</h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Ce compte interne existe mais n&apos;a ni mot de passe ni second facteur. Il ne peut donc pas
          ouvrir le back-office.
        </p>
        <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
          Demandez un lien de configuration à l&apos;administrateur principal. Personne d&apos;autre ne peut en
          émettre, et aucun mot de passe temporaire n&apos;existe.
        </p>
      </div>
    </div>
  );
}
