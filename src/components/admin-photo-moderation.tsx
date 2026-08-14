"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PendingPhoto {
  id: string;
  url: string;
  firstName: string;
  submittedAt: string;
  status: string;
  autoReason: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente d'examen",
  REVIEW_REQUIRED: "Doute du contrôle automatique",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};

/**
 * §35 — file de modération des photos (M4).
 *
 * Trois issues, dont « mettre de côté ». Forcer un modérateur qui hésite à
 * choisir entre approuver et refuser produit des décisions arbitraires ; lui
 * donner le droit de passer la main produit de meilleures décisions.
 */
export function PhotoModerationQueue({ photos }: { photos: PendingPhoto[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function decide(photoId: string, decision: "APPROVED" | "REJECTED" | "REVIEW_REQUIRED") {
    setBusy(photoId);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId, decision, reason: reasons[photoId] }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Action impossible.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="e-card p-4 text-sm" style={{ color: "var(--fg-muted)" }}>
        Aucune photo en attente.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="text-sm mb-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {photos.map((photo) => {
          const reason = (reasons[photo.id] ?? "").trim();
          return (
            <li
              key={photo.id}
              className="e-card p-3"
              style={
                photo.status === "REVIEW_REQUIRED" ? { borderColor: "var(--color-gold-400)" } : undefined
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="w-full aspect-square object-cover rounded-xl"
                style={{ border: "1px solid var(--border)" }}
              />
              <p className="text-sm font-semibold mt-2">{photo.firstName}</p>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                {STATUS_LABEL[photo.status] ?? photo.status} · envoyée le{" "}
                {new Date(photo.submittedAt).toLocaleDateString("fr-FR")}
              </p>
              {photo.autoReason && (
                <p className="text-xs mt-1" style={{ color: "var(--color-gold-500)" }}>
                  {photo.autoReason}
                </p>
              )}

              <input
                className="e-input mt-2"
                style={{ fontSize: "0.8125rem", minHeight: "2.25rem" }}
                placeholder="Motif (requis pour refuser ou mettre de côté)"
                value={reasons[photo.id] ?? ""}
                onChange={(event) => setReasons((prev) => ({ ...prev, [photo.id]: event.target.value }))}
                aria-label="Motif de la décision"
              />

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="e-btn e-btn-secondary flex-1"
                  style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
                  onClick={() => void decide(photo.id, "REJECTED")}
                  disabled={busy === photo.id || reason.length < 5}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  className="e-btn e-btn-primary flex-1"
                  style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
                  onClick={() => void decide(photo.id, "APPROVED")}
                  disabled={busy === photo.id}
                >
                  Approuver
                </button>
              </div>

              {photo.status !== "REVIEW_REQUIRED" && (
                <button
                  type="button"
                  className="e-btn e-btn-ghost w-full mt-1"
                  style={{ minHeight: "2rem", fontSize: "0.75rem" }}
                  onClick={() => void decide(photo.id, "REVIEW_REQUIRED")}
                  disabled={busy === photo.id || reason.length < 5}
                >
                  Je préfère passer la main
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
