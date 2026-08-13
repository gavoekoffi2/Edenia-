"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §27, §28 — demande de vérification.
 *
 * Pour l'église, le consentement est une case décochée par défaut, accompagnée
 * du texte exact de ce qui sera demandé. Un consentement pré-coché n'en est pas
 * un, surtout pour une donnée sensible (C6).
 */
export function VerificationRequestForm({
  kind,
  churches,
}: {
  kind: "IDENTITY" | "PROFILE" | "CHURCH";
  churches: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [churchId, setChurchId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, churchId: churchId || undefined, consent }),
      });
      const payload = await response.json();
      setMessage(payload.data?.message ?? payload.error ?? "Demande envoyée.");
      if (response.ok) router.refresh();
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {kind === "CHURCH" && (
        <>
          <select
            className="e-input"
            value={churchId}
            onChange={(event) => setChurchId(event.target.value)}
            aria-label="Mon église"
          >
            <option value="">Choisir mon église…</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>

          <label className="flex gap-2 text-xs items-start">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              J'autorise EDENIA à poser à un responsable de mon église une <strong>question unique</strong> :
              « Reconnaissez-vous cette personne comme quelqu'un que votre église connaît ? » Aucune autre
              information ne sera demandée ni transmise. Je peux retirer cet accord à tout moment.
            </span>
          </label>
        </>
      )}

      {kind === "IDENTITY" && (
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Vous pourrez envoyer une pièce d'identité et un selfie de façon sécurisée. Les documents sont
          chiffrés et détruits au plus tard 7 jours après la décision.
        </p>
      )}

      <button type="button" className="e-btn e-btn-secondary w-full" onClick={() => void submit()} disabled={busy}>
        {busy ? "Envoi…" : "Demander cette vérification"}
      </button>

      {message && (
        <p className="text-xs" role="status" style={{ color: "var(--fg-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
