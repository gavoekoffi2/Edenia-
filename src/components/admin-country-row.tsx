"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ouvert",
  TEST: "Test interne",
  COMING_SOON: "Bientôt",
  PAUSED: "Suspendu",
};

/** §20 — une ligne de pays, avec son statut éditorial modifiable. */
export function AdminCountryRow({
  code,
  nameFr,
  dialCode,
  status,
  isLaunched,
  servedAtBoot,
  profiles,
}: {
  code: string;
  nameFr: string;
  dialCode: string;
  status: string;
  isLaunched: boolean;
  servedAtBoot: boolean;
  profiles: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/countries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, status: next }),
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
      setBusy(false);
    }
  }

  // Un désaccord entre le statut éditorial et ce que le serveur sert
  // réellement produit des bugs impossibles à diagnostiquer depuis l'interface.
  const mismatch = (status === "ACTIVE") !== servedAtBoot;

  return (
    <li className="e-card p-3" style={mismatch ? { borderColor: "var(--color-gold-400)" } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {nameFr} <span style={{ color: "var(--fg-muted)" }}>{code} · {dialCode}</span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
            {profiles.toLocaleString("fr-FR")} profil(s)
            {servedAtBoot ? " · servi au démarrage" : " · non servi au démarrage"}
            {isLaunched ? " · marqué lancé" : ""}
          </p>
        </div>

        <select
          className="e-input"
          style={{ maxWidth: "12rem" }}
          value={status}
          disabled={busy}
          onChange={(event) => void update(event.target.value)}
          aria-label={`Statut de ${nameFr}`}
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {mismatch && (
        <p className="text-xs mt-2" style={{ color: "var(--color-gold-500)" }}>
          {status === "ACTIVE"
            ? "Marqué ouvert, mais absent de LAUNCHED_COUNTRIES : les inscriptions y sont refusées."
            : "Servi au démarrage mais pas marqué ouvert : incohérence à corriger."}
        </p>
      )}

      {error && (
        <p className="text-xs mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}
    </li>
  );
}
