"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * §19 — page de retour de paiement.
 *
 * Point capital : **le retour sur cette page ne confirme rien**. Le composant
 * interroge le backend, qui interroge GeniusPay. Tant que le paiement n'est pas
 * confirmé, on affiche « nous vérifions », jamais « c'est bon ».
 */

interface Status {
  status: string;
  label: string;
  planName: string | null;
  method: string | null;
  isPremium: boolean;
  premiumEndsAt: string | null;
}

const POLL_DELAYS_MS = [1500, 2500, 4000, 6000, 8000];

export function PaymentResult({ orderRef, expected }: { orderRef: string; expected: "SUCCESS" | "ERROR" }) {
  const [state, setState] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch(`/api/v1/payments/status?ref=${encodeURIComponent(orderRef)}`);
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? "Statut indisponible.");
          return;
        }
        setState(payload.data as Status);

        // On continue d'interroger tant que le paiement n'est pas tranché : le
        // webhook peut arriver quelques secondes après le retour de l'utilisateur.
        const pending = payload.data.status === "PENDING" || payload.data.status === "PROCESSING";
        if (pending && attempt < POLL_DELAYS_MS.length) {
          setTimeout(() => !cancelled && setAttempt((n) => n + 1), POLL_DELAYS_MS[attempt]);
        }
      } catch {
        if (!cancelled) setError("Connexion impossible. Votre paiement n'est pas perdu.");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [orderRef, attempt]);

  if (error) {
    return (
      <Shell emoji="⚠️" title="Nous n'avons pas pu lire le statut">
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Référence : <code>{orderRef}</code>. Conservez-la si vous contactez le support.
        </p>
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell emoji="⏳" title="Vérification en cours">
        <p>Nous vérifions votre paiement auprès de l'opérateur…</p>
      </Shell>
    );
  }

  if (state.status === "COMPLETED" && state.isPremium) {
    return (
      <Shell emoji="✦" title="Paiement confirmé">
        <p>
          Votre abonnement {state.planName ?? "Premium"} est actif
          {state.premiumEndsAt && ` jusqu'au ${new Date(state.premiumEndsAt).toLocaleDateString("fr-FR")}`}.
        </p>
        <Link href="/app/decouvrir" className="e-btn e-btn-primary mt-5">
          Découvrir des profils
        </Link>
      </Shell>
    );
  }

  if (state.status === "PENDING" || state.status === "PROCESSING") {
    return (
      <Shell emoji="⏳" title="Nous vérifions encore votre paiement">
        <p>
          Votre opérateur n'a pas encore confirmé la transaction. Cela prend parfois quelques minutes —
          il n'y a rien à refaire de votre côté.
        </p>
        <p className="mt-2 text-sm">
          Vous recevrez une notification dès l'activation. Référence : <code>{orderRef}</code>.
        </p>
        <Link href="/app/premium" className="e-btn e-btn-secondary mt-5">
          Retour
        </Link>
      </Shell>
    );
  }

  const failureText: Record<string, string> = {
    FAILED: "Le paiement a été refusé par l'opérateur. Aucun montant n'a été débité.",
    CANCELLED: "Le paiement a été annulé. Aucun montant n'a été débité.",
    EXPIRED: "Le lien de paiement a expiré. Vous pouvez en relancer un.",
    REFUNDED: "Ce paiement a été remboursé. Votre abonnement Premium est désactivé.",
  };

  return (
    <Shell emoji={expected === "SUCCESS" ? "⚠️" : "✕"} title={state.label}>
      <p>{failureText[state.status] ?? "Le paiement n'a pas abouti."}</p>
      <p className="mt-2 text-sm">
        Référence : <code>{orderRef}</code>
      </p>
      <Link href="/app/premium" className="e-btn e-btn-primary mt-5">
        Réessayer
      </Link>
    </Shell>
  );
}

function Shell({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="e-card p-8 max-w-md text-center">
        <p className="text-4xl" aria-hidden="true">
          {emoji}
        </p>
        <h1 className="e-display text-2xl mt-3">{title}</h1>
        <div className="mt-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
