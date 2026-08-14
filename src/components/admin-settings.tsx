"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditableSetting {
  key: string;
  label: string;
  help: string;
  type: "boolean" | "text";
  value: string;
  isProtected: boolean;
  overridden: boolean;
}

/** §22 — interrupteurs d'exploitation, effet immédiat. */
export function AdminSettings({
  settings,
  canWrite,
  isSuperAdmin,
}: {
  settings: EditableSetting[];
  canWrite: boolean;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function save(key: string, value: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Modification impossible.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="e-display text-lg mb-2">Exploitation</h2>
      {error && (
        <p className="text-sm mb-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {settings.map((setting) => {
          const locked = !canWrite || (setting.isProtected && !isSuperAdmin);
          return (
            <li key={setting.key} className="e-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {setting.label}
                    {setting.isProtected && <span className="e-chip ml-2">protégé</span>}
                    {setting.overridden && <span className="e-chip ml-1">modifié</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {setting.help}
                  </p>
                </div>

                {setting.type === "boolean" ? (
                  <button
                    type="button"
                    className={setting.value === "true" ? "e-btn e-btn-primary" : "e-btn e-btn-secondary"}
                    style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
                    disabled={locked || busy === setting.key}
                    onClick={() => void save(setting.key, setting.value === "true" ? "false" : "true")}
                  >
                    {setting.value === "true" ? "Activé" : "Désactivé"}
                  </button>
                ) : (
                  <div className="flex gap-2 items-end">
                    <input
                      className="e-input"
                      style={{ minWidth: "16rem", minHeight: "2.25rem", fontSize: "0.8125rem" }}
                      value={drafts[setting.key] ?? setting.value}
                      disabled={locked}
                      maxLength={280}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [setting.key]: event.target.value }))
                      }
                      aria-label={setting.label}
                    />
                    <button
                      type="button"
                      className="e-btn e-btn-secondary"
                      style={{ minHeight: "2.25rem", fontSize: "0.8125rem" }}
                      disabled={locked || busy === setting.key}
                      onClick={() => void save(setting.key, drafts[setting.key] ?? setting.value)}
                    >
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>

              {locked && setting.isProtected && !isSuperAdmin && (
                <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                  Réservé à l&apos;administrateur principal.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
