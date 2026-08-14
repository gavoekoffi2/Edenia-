"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §35 — sanctions depuis la liste des utilisateurs.
 *
 * Le motif est exigé avant l'envoi, pas après : c'est ce qui fait la différence
 * entre une décision qu'on peut expliquer au membre et une décision qu'on
 * subit.
 */
export function AdminUserActions({
  userId,
  status,
  canSuspend,
  canBan,
}: {
  userId: string;
  status: string;
  canSuspend: boolean;
  canBan: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"SUSPENDED" | "BANNED" | "ACTIVE" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: "SUSPENDED" | "BANNED" | "ACTIVE") {
    if (reason.trim().length < 5) {
      setError("Le motif est obligatoire (5 caractères minimum).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, status: next, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Action impossible.");
        return;
      }
      setOpen(null);
      setReason("");
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!canSuspend && !canBan) return null;

  return (
    <div className="text-right">
      <div className="flex gap-1.5 justify-end">
        {status !== "ACTIVE" && (
          <button
            type="button"
            className="e-btn e-btn-ghost"
            style={{ fontSize: "0.75rem" }}
            onClick={() => setOpen(open === "ACTIVE" ? null : "ACTIVE")}
          >
            Réactiver
          </button>
        )}
        {canSuspend && status === "ACTIVE" && (
          <button
            type="button"
            className="e-btn e-btn-ghost"
            style={{ fontSize: "0.75rem" }}
            onClick={() => setOpen(open === "SUSPENDED" ? null : "SUSPENDED")}
          >
            Suspendre
          </button>
        )}
        {canBan && status !== "BANNED" && (
          <button
            type="button"
            className="e-btn e-btn-ghost"
            style={{ fontSize: "0.75rem", color: "var(--color-danger-500)" }}
            onClick={() => setOpen(open === "BANNED" ? null : "BANNED")}
          >
            Bannir
          </button>
        )}
      </div>

      {open && (
        <div className="e-card p-3 mt-2 text-left" style={{ minWidth: "18rem" }}>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Motif ({open === "ACTIVE" ? "réactivation" : open === "BANNED" ? "bannissement" : "suspension"})
            </span>
            <textarea
              className="e-input mt-1"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="e-btn e-btn-secondary flex-1"
              style={{ fontSize: "0.8125rem" }}
              onClick={() => {
                setOpen(null);
                setError(null);
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="e-btn e-btn-primary flex-1"
              style={{ fontSize: "0.8125rem" }}
              onClick={() => void apply(open)}
              disabled={busy}
            >
              {busy ? "…" : "Confirmer"}
            </button>
          </div>
          {error && (
            <p className="text-xs mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
