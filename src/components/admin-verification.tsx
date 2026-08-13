"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §27 — decision de verification.
 * Le bouton d'approbation reste desactive tant que la liste de controle n'est
 * pas entierement cochee : c'est la regle du §27 rendue impossible a contourner.
 */
export function VerificationDecision({
  requestId,
  kind,
  checklist,
}: {
  requestId: string;
  kind: string;
  checklist: Array<{ code: string; label: string; legalNote?: string }>;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checklist.every((item) => checked.has(item.code));

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, kind, approve, checkedCodes: [...checked], reason }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Décision impossible.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
        Contrôles à effectuer
      </p>
      <ul className="mt-2 space-y-1.5">
        {checklist.map((item) => (
          <li key={item.code}>
            <label className="flex gap-2 text-sm items-start">
              <input
                type="checkbox"
                checked={checked.has(item.code)}
                onChange={(event) =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) next.add(item.code);
                    else next.delete(item.code);
                    return next;
                  })
                }
                style={{ marginTop: "0.25rem" }}
              />
              <span>
                {item.label}
                {item.legalNote && (
                  <span className="block text-xs" style={{ color: "var(--fg-muted)" }}>
                    {item.legalNote}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <textarea
        className="e-input mt-3"
        rows={2}
        placeholder="Motif (obligatoire en cas de refus — la personne le recevra)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        aria-label="Motif de la décision"
      />

      {error && (
        <p className="text-sm mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className="e-btn e-btn-secondary flex-1"
          onClick={() => void decide(false)}
          disabled={busy || reason.trim().length < 10}
        >
          Refuser
        </button>
        <button
          type="button"
          className="e-btn e-btn-primary flex-1"
          onClick={() => void decide(true)}
          disabled={busy || !allChecked}
          title={allChecked ? undefined : "Tous les contrôles doivent être validés"}
        >
          Approuver
        </button>
      </div>
      {!allChecked && (
        <p className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }}>
          {checklist.length - checked.size} contrôle(s) restant(s) avant de pouvoir approuver.
        </p>
      )}
    </div>
  );
}
