"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SANCTION_LADDER } from "@/lib/config/enums";
import { SANCTION_LABEL } from "@/lib/moderation/sanctions";

/** §35 — application d'une sanction. Le motif est toujours obligatoire. */
export function ModerationDecision({ reportId, recommended }: { reportId: string; recommended: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(recommended);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/moderation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, outcome, reason }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Action impossible.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[...SANCTION_LADDER, "NO_ACTION"].map((value) => (
          <button
            key={value}
            type="button"
            className={outcome === value ? "e-chip e-chip-gold" : "e-chip"}
            style={{ cursor: "pointer" }}
            aria-pressed={outcome === value}
            onClick={() => setOutcome(value)}
          >
            {value === "NO_ACTION" ? "Aucune action" : SANCTION_LABEL[value as keyof typeof SANCTION_LABEL]}
          </button>
        ))}
      </div>

      <textarea
        className="e-input"
        rows={2}
        placeholder="Motif de la décision (obligatoire, conservé dans le journal d'audit)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        aria-label="Motif"
      />

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="e-btn e-btn-primary w-full"
        onClick={() => void submit()}
        disabled={busy || reason.trim().length < 5}
      >
        {busy ? "Application…" : "Appliquer la décision"}
      </button>
    </div>
  );
}
