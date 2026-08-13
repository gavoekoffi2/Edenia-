export const metadata = { title: "Hors ligne", robots: { index: false } };

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <p className="text-4xl" aria-hidden="true">📶</p>
        <h1 className="e-display text-2xl mt-4">Connexion perdue</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          EDENIA n'arrive pas à joindre le réseau. Vos données ne sont pas perdues — réessayez dès que
          la connexion revient.
        </p>
        <a href="/app/decouvrir" className="e-btn e-btn-primary mt-6">
          Réessayer
        </a>
      </div>
    </div>
  );
}
