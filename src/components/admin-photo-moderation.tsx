"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PendingPhoto {
  id: string;
  url: string;
  firstName: string;
  submittedAt: string;
}

/** §35 — file de modération des photos, avant publication (M4). */
export function PhotoModerationQueue({ photos }: { photos: PendingPhoto[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function decide(photoId: string, approve: boolean) {
    setBusy(photoId);
    try {
      await fetch("/api/v1/admin/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId, approve, reason: reasons[photoId] }),
      });
      router.refresh();
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
    <ul className="grid gap-3 sm:grid-cols-2">
      {photos.map((photo) => (
        <li key={photo.id} className="e-card p-3">
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
            Envoyée le {new Date(photo.submittedAt).toLocaleDateString("fr-FR")}
          </p>
          <input
            className="e-input mt-2"
            style={{ fontSize: "0.8125rem", minHeight: "2.25rem" }}
            placeholder="Motif (requis pour refuser)"
            value={reasons[photo.id] ?? ""}
            onChange={(event) => setReasons((prev) => ({ ...prev, [photo.id]: event.target.value }))}
            aria-label="Motif du refus"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="e-btn e-btn-secondary flex-1"
              style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
              onClick={() => void decide(photo.id, false)}
              disabled={busy === photo.id || (reasons[photo.id] ?? "").trim().length < 5}
            >
              Refuser
            </button>
            <button
              type="button"
              className="e-btn e-btn-primary flex-1"
              style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
              onClick={() => void decide(photo.id, true)}
              disabled={busy === photo.id}
            >
              Approuver
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
