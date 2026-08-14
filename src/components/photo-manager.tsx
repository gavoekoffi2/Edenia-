"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Gestion des photos de profil (§62 étape 8).
 *
 * Le statut de modération est affiché sans détour : une photo en attente est
 * annoncée comme telle plutôt que de laisser croire qu'elle est déjà visible.
 */

interface Photo {
  id: string;
  url: string;
  blurhash: string | null;
  isPrimary: boolean;
  moderationStatus: string;
  moderationReason?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "wait" | "bad" }> = {
  APPROVED: { label: "Visible", tone: "ok" },
  PENDING: { label: "En attente de vérification", tone: "wait" },
  REJECTED: { label: "Refusée", tone: "bad" },
};

export function PhotoManager() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [max, setMax] = useState(6);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const response = await fetch("/api/v1/photos");
      if (!response.ok) return;
      const payload = await response.json();
      setPhotos(payload.data.photos);
      setMax(payload.data.max);
    } catch {
      // Silencieux : l'écran reste utilisable sans la liste.
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const response = await fetch("/api/v1/photos", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Envoi impossible.");
        return;
      }
      setMessage(payload.data.message);
      await load();
      router.refresh();
    } catch {
      setError("Connexion perdue pendant l'envoi. Réessayez.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/v1/photos/${id}`, { method: "DELETE" });
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/photos/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Action impossible.");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="e-card p-4">
      <h2 className="e-display text-lg">Mes photos</h2>
      <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
        {photos.length} / {max}. Les photos sont redimensionnées et leurs métadonnées de localisation
        supprimées avant enregistrement.
      </p>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 mt-3">
          {photos.map((photo) => {
            const status = STATUS_LABEL[photo.moderationStatus] ?? STATUS_LABEL.PENDING!;
            return (
              <li key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-square object-cover rounded-xl"
                  style={{
                    border: photo.isPrimary ? "2px solid var(--color-clay-500)" : "1px solid var(--border)",
                    opacity: photo.moderationStatus === "APPROVED" ? 1 : 0.6,
                  }}
                />
                <span
                  className="e-chip absolute top-1 left-1"
                  style={{
                    fontSize: "0.5625rem",
                    padding: "0.0625rem 0.375rem",
                    background:
                      status.tone === "ok"
                        ? "var(--color-success-100)"
                        : status.tone === "bad"
                          ? "var(--color-danger-100)"
                          : "var(--color-gold-100)",
                  }}
                >
                  {photo.isPrimary ? "Principale" : status.label}
                </span>
                <div className="flex gap-1 mt-1">
                  {!photo.isPrimary && photo.moderationStatus === "APPROVED" && (
                    <button
                      type="button"
                      className="e-btn e-btn-ghost"
                      style={{ fontSize: "0.6875rem", minHeight: "1.75rem", padding: "0 0.375rem" }}
                      onClick={() => void makePrimary(photo.id)}
                      disabled={busy}
                    >
                      Principale
                    </button>
                  )}
                  <button
                    type="button"
                    className="e-btn e-btn-ghost"
                    style={{ fontSize: "0.6875rem", minHeight: "1.75rem", padding: "0 0.375rem", color: "var(--color-danger-500)" }}
                    onClick={() => void remove(photo.id)}
                    disabled={busy}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        id="photo-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {photos.length < max && (
        <label htmlFor="photo-input" className="e-btn e-btn-secondary w-full mt-3" style={{ cursor: "pointer" }}>
          {busy ? "Envoi…" : "📷 Ajouter une photo"}
        </label>
      )}

      {message && (
        <p className="text-sm mt-2" role="status" style={{ color: "var(--color-success-600)" }}>
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
