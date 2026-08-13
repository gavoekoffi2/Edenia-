"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_CATEGORY, REPORT_CATEGORY_LABEL, type ReportCategory } from "@/lib/config/enums";

/**
 * Actions sur un profil : liker, passer, signaler, bloquer.
 *
 * §60 : signaler et bloquer sont toujours accessibles, au meme niveau que le
 * like. Les enterrer dans un sous-menu reviendrait a decourager leur usage.
 */
export function ProfileActions({ targetId, firstName }: { targetId: string; firstName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);
  const [showReport, setShowReport] = useState(false);

  async function act(kind: "LIKE" | "PASS") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, kind }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Action impossible.");
        return;
      }
      if (payload.data.status === "MATCHED") {
        setMatched(true);
        setMessage(`Vous et ${firstName} vous êtes likés — la conversation est ouverte.`);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function report(category: ReportCategory) {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, category }),
      });
      const payload = await response.json();
      setMessage(payload.data?.message ?? payload.error ?? "Signalement enregistré.");
      setShowReport(false);
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      await fetch("/api/v1/blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      setMessage("Profil bloqué. Vous ne verrez plus cette personne.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (matched) {
    return (
      <div className="e-card p-4 mt-2 text-center">
        <p className="e-display text-lg">❤️ C'est un match</p>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {message}
        </p>
        <a href="/app/messages" className="e-btn e-btn-primary mt-3">
          Voir la conversation
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" className="e-btn e-btn-secondary flex-1" onClick={() => void act("PASS")} disabled={busy}>
          Passer
        </button>
        <button type="button" className="e-btn e-btn-primary flex-1" onClick={() => void act("LIKE")} disabled={busy}>
          ❤️ Liker
        </button>
      </div>

      <div className="flex gap-3 mt-2 justify-center">
        <button
          type="button"
          className="e-btn e-btn-ghost"
          style={{ fontSize: "0.75rem" }}
          onClick={() => setShowReport((value) => !value)}
        >
          Signaler
        </button>
        <button
          type="button"
          className="e-btn e-btn-ghost"
          style={{ fontSize: "0.75rem" }}
          onClick={() => void block()}
          disabled={busy}
        >
          Bloquer
        </button>
      </div>

      {showReport && (
        <div className="e-card p-3 mt-2">
          <p className="text-sm font-semibold mb-2">Que se passe-t-il ?</p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_CATEGORY.map((category) => (
              <button
                key={category}
                type="button"
                className="e-chip"
                style={{ cursor: "pointer" }}
                onClick={() => void report(category)}
                disabled={busy}
              >
                {REPORT_CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p className="text-sm mt-2 text-center" role="status" style={{ color: "var(--fg-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
