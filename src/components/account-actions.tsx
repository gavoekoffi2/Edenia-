"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/account", { method: "DELETE" });
      if (response.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="e-card p-4 space-y-3">
      <button type="button" className="e-btn e-btn-secondary w-full" onClick={() => void logout()}>
        Se déconnecter
      </button>

      {confirming ? (
        <div>
          <p className="text-sm">
            Votre profil disparaît immédiatement. Vos données personnelles sont effacées sous 30 jours.
            Cette action est irréversible.
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" className="e-btn e-btn-secondary flex-1" onClick={() => setConfirming(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="e-btn e-btn-primary flex-1"
              style={{ background: "var(--color-danger-500)" }}
              onClick={() => void remove()}
              disabled={busy}
            >
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="e-btn e-btn-ghost w-full"
          style={{ color: "var(--color-danger-500)" }}
          onClick={() => setConfirming(true)}
        >
          Supprimer mon compte
        </button>
      )}
    </section>
  );
}
