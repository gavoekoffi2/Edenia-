"use client";

import { useState } from "react";

/**
 * §4, §5 — formulaire de soutien.
 *
 * Le texte est aussi important que le code : il dit explicitement qu'un don
 * n'achète rien. Une plateforme qui laisse planer le doute finit par créer une
 * classe de membres privilégiés sans jamais l'avoir décidé.
 */
/*
 * Repères de montant, pas une grille imposée : le champ libre reste ouvert et
 * le serveur n'impose qu'un plancher (200 F) et un plafond. Ils vivent ici,
 * dans l'interface, parce que c'est une question d'ergonomie — les placer côté
 * service laisserait croire à une règle métier qui n'existe pas.
 */
const PRESETS = [500, 1000, 2000, 5000, 10000];

export function DonationForm({ signedIn }: { signedIn: boolean }) {
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState("");
  const [donorName, setDonorName] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective = custom.trim() ? Number.parseInt(custom.replace(/\s/g, ""), 10) : amount;
  const valid = Number.isFinite(effective) && effective >= 200;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/donations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountCents: effective,
          donorName: donorName.trim() || undefined,
          message: message.trim() || undefined,
          isAnonymous,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Le don n'a pas pu être ouvert.");
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
    <form onSubmit={submit} className="e-card p-5">
      <fieldset className="border-0 p-0 m-0">
        <legend className="text-sm font-semibold mb-2">Montant</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={preset === amount && !custom.trim() ? "e-btn e-btn-primary" : "e-btn e-btn-secondary"}
              style={{ minHeight: "2.5rem", padding: "0.375rem 0.875rem" }}
              onClick={() => {
                setAmount(preset);
                setCustom("");
              }}
            >
              {preset.toLocaleString("fr-FR")} F
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block mt-4">
        <span className="text-sm font-semibold">Ou un autre montant (FCFA)</span>
        <input
          className="e-input mt-1"
          inputMode="numeric"
          placeholder="Minimum 200 F"
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/[^\d\s]/g, ""))}
        />
      </label>

      {!signedIn && (
        <label className="block mt-4">
          <span className="text-sm font-semibold">Votre nom (facultatif)</span>
          <input
            className="e-input mt-1"
            value={donorName}
            onChange={(event) => setDonorName(event.target.value)}
            maxLength={80}
          />
        </label>
      )}

      <label className="block mt-4">
        <span className="text-sm font-semibold">Un mot pour l'équipe (facultatif)</span>
        <textarea
          className="e-input mt-1"
          rows={2}
          maxLength={500}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>

      <label className="flex items-start gap-2 mt-4 text-sm">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(event) => setIsAnonymous(event.target.checked)}
          className="mt-1"
        />
        <span>Rester anonyme. Votre nom n&apos;apparaîtra nulle part.</span>
      </label>

      <button type="submit" className="e-btn e-btn-primary w-full mt-5" disabled={!valid || busy}>
        {busy ? "…" : `Soutenir avec ${valid ? effective.toLocaleString("fr-FR") : "—"} F`}
      </button>

      {error && (
        <p className="text-sm mt-3" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <p className="text-xs mt-4" style={{ color: "var(--fg-muted)" }}>
        Un don ne donne aucun avantage : ni badge, ni meilleure visibilité, ni priorité dans les
        suggestions. EDENIA est gratuite, et le reste que vous donniez ou non.
      </p>
    </form>
  );
}
