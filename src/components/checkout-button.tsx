"use client";

import { useState } from "react";

/**
 * §8 — bouton de paiement.
 *
 * EDENIA ne demande aucune donnée de paiement : pas de champ carte, pas de CVV,
 * pas de code Mobile Money (§17). On crée la transaction côté serveur, puis on
 * redirige vers le checkout hébergé, où le client choisit son moyen.
 */
export function CheckoutButton({ planCode, simulated }: { planCode: string; simulated: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Paiement impossible pour le moment.");
        return;
      }
      window.location.href = payload.data.checkoutUrl;
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" className="e-btn e-btn-primary w-full" onClick={() => void start()} disabled={busy}>
        {busy ? "Préparation du paiement…" : "Continuer vers le paiement"}
      </button>
      <p className="text-xs mt-1.5 text-center" style={{ color: "var(--fg-muted)" }}>
        {simulated
          ? "Mode test — vous serez redirigé vers un checkout simulé."
          : "Vous serez redirigé vers la page sécurisée de GeniusPay."}
      </p>
      {error && (
        <p className="text-sm mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
