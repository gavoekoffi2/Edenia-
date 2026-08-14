"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Reproduction locale de la page de checkout GeniusPay — mode test uniquement.
 *
 * §9 : rien ici ne doit pouvoir passer pour la vraie page. Le bandeau le dit,
 * et cet écran n'existe pas quand un agrégateur réel est configuré.
 */
interface Outcome {
  key: "success" | "failed" | "cancelled" | "expired";
  label: string;
  primary?: boolean;
}

const OUTCOMES: readonly Outcome[] = [
  { key: "success", label: "Payer (succès)", primary: true },
  { key: "failed", label: "Simuler un échec" },
  { key: "cancelled", label: "Simuler une annulation" },
  { key: "expired", label: "Simuler une expiration" },
];

export function SimulatedCheckout({
  orderRef,
  amountLabel,
  planName,
  endpoint = "/api/v1/payments/simulate",
}: {
  orderRef: string;
  amountLabel: string;
  planName: string;
  /** Les dons empruntent la même page mais leur propre point d'entrée. */
  endpoint?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(outcome: string) {
    setBusy(outcome);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderRef, outcome }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Simulation impossible.");
        return;
      }
      router.push(payload.data.next);
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="e-card p-6 max-w-sm w-full">
        <div
          className="rounded-xl p-3 text-sm mb-5"
          style={{ background: "var(--color-gold-100)", border: "1px solid var(--color-gold-400)", color: "#7a5216" }}
          role="note"
        >
          <p className="font-bold">🟡 CHECKOUT SIMULÉ — MODE TEST</p>
          <p className="mt-1 text-xs">
            Ceci n'est pas la page GeniusPay. Aucun débit réel. Le webhook envoyé est authentiquement
            signé et traverse le même code qu'en production.
          </p>
        </div>

        <p className="text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
          EDENIA · {planName}
        </p>
        <p className="e-display text-3xl mt-1">{amountLabel}</p>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Référence : {orderRef}
        </p>

        <div className="mt-6 space-y-2">
          {OUTCOMES.map((outcome) => (
            <button
              key={outcome.key}
              type="button"
              className={outcome.primary ? "e-btn e-btn-primary w-full" : "e-btn e-btn-secondary w-full"}
              onClick={() => void pay(outcome.key)}
              disabled={busy !== null}
            >
              {busy === outcome.key ? "…" : outcome.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm mt-3" role="alert" style={{ color: "var(--color-danger-500)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
