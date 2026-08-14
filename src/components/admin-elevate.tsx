"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §9, §50 — écran d'élévation.
 *
 * Le message d'échec est le même pour un mot de passe faux et un code faux :
 * distinguer les deux dirait à un attaquant qu'il a déjà trouvé la moitié.
 */
export function AdminElevate({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/elevate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, code: code.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Identifiants incorrects.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="e-card p-6">
      <h1 className="e-display text-xl">Back-office</h1>
      <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
        {displayName} — votre mot de passe et votre second facteur sont demandés à chaque session.
      </p>

      <label className="block mt-5">
        <span className="text-sm">Mot de passe administrateur</span>
        <input
          className="e-input mt-1"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
        />
      </label>

      <label className="block mt-3">
        <span className="text-sm">{useRecovery ? "Code de récupération" : "Code à 6 chiffres"}</span>
        <input
          className="e-input mt-1"
          inputMode={useRecovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={useRecovery ? 11 : 6}
          value={code}
          onChange={(event) =>
            setCode(useRecovery ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ""))
          }
          required
        />
      </label>

      <button type="submit" className="e-btn e-btn-primary w-full mt-5" disabled={busy}>
        {busy ? "…" : "Ouvrir le back-office"}
      </button>

      <button
        type="button"
        className="e-btn e-btn-ghost w-full mt-2"
        style={{ fontSize: "0.8125rem" }}
        onClick={() => {
          setUseRecovery((value) => !value);
          setCode("");
        }}
      >
        {useRecovery ? "Utiliser mon application d'authentification" : "J'ai perdu mon téléphone"}
      </button>

      {error && (
        <p className="text-sm mt-3" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
