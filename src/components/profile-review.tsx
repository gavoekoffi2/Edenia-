"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §14 — « L'utilisateur garde toujours le contrôle. »
 *
 * Cet écran est le point de passage obligé entre ce que l'IA a compris et ce
 * qui est réellement enregistré. Chaque valeur est modifiable, et les champs
 * marqués « à confirmer » (§13) bloquent la publication tant qu'ils n'ont pas
 * été validés un par un.
 */

export interface PreviewRow {
  key: string;
  label: string;
  value: string;
  rawValue: unknown;
  needsConfirmation: boolean;
}

export interface GeneratedSections {
  bio: string;
  values: string;
  marriageVision: string;
  lookingFor: string;
  interests: string[];
  toDiscuss: Array<{ key: string; label: string }>;
}

export interface CityOption {
  id: string;
  label: string;
}

export function ProfileReview({
  rows,
  generated,
  cities,
  defaultCityId,
}: {
  rows: PreviewRow[];
  generated: GeneratedSections | null;
  cities: CityOption[];
  defaultCityId: string | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, unknown>>(
    Object.fromEntries(rows.map((row) => [row.key, row.rawValue])),
  );
  const [displays, setDisplays] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );
  const [confirmed, setConfirmed] = useState<Set<string>>(
    new Set(rows.filter((row) => !row.needsConfirmation).map((row) => row.key)),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const [bio, setBio] = useState(generated?.bio ?? "");
  const [gender, setGender] = useState<"F" | "M">("F");
  const [seeking, setSeeking] = useState<"F" | "M">("M");
  const [birthDate, setBirthDate] = useState("");
  const [cityId, setCityId] = useState(defaultCityId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = rows.filter((row) => !confirmed.has(row.key) && !removed.has(row.key));
  const canPublish = pending.length === 0 && birthDate !== "" && cityId !== "";

  function edit(key: string, text: string) {
    setDisplays((prev) => ({ ...prev, [key]: text }));
    // Une valeur corrigée à la main devient une chaîne : c'est la parole de
    // l'utilisateur qui fait foi, pas la structure devinée par l'IA.
    setValues((prev) => ({ ...prev, [key]: text }));
    setConfirmed((prev) => new Set(prev).add(key));
  }

  async function submit(publish: boolean) {
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([key]) => !removed.has(key) && confirmed.has(key)),
      );

      const response = await fetch("/api/v1/onboarding/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: payload, gender, seeking, birthDate, cityId, bio, publish }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Enregistrement impossible.");
        return;
      }
      router.push(publish ? "/app/decouvrir" : "/app/profil");
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="e-display text-2xl">✨ Votre profil est prêt</h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Relisez, corrigez, puis validez. Rien n'est visible par d'autres personnes tant que vous n'avez
          pas publié.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="e-card p-4" style={{ borderColor: "var(--color-gold-400)" }}>
          <p className="text-sm font-semibold">
            {pending.length} information{pending.length > 1 ? "s" : ""} à confirmer
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Pour les informations importantes, nous demandons toujours votre accord explicite plutôt que de
            supposer. Confirmez, corrigez, ou retirez.
          </p>
        </div>
      )}

      {/* --- Champs extraits ------------------------------------------------ */}
      <section className="space-y-2">
        <h2 className="e-display text-lg">Vos informations</h2>
        {rows.map((row) => {
          const isRemoved = removed.has(row.key);
          const isConfirmed = confirmed.has(row.key);
          return (
            <div
              key={row.key}
              className="e-card p-3"
              style={isRemoved ? { opacity: 0.45 } : undefined}
            >
              <label className="e-label" htmlFor={`field-${row.key}`}>
                {row.label}
              </label>
              <input
                id={`field-${row.key}`}
                className="e-input"
                value={displays[row.key] ?? ""}
                onChange={(event) => edit(row.key, event.target.value)}
                disabled={isRemoved}
              />
              <div className="flex items-center gap-2 mt-2">
                {!isConfirmed && !isRemoved && (
                  <button
                    type="button"
                    className="e-btn e-btn-secondary"
                    style={{ minHeight: "2rem", fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                    onClick={() => setConfirmed((prev) => new Set(prev).add(row.key))}
                  >
                    C'est exact
                  </button>
                )}
                {isConfirmed && !isRemoved && (
                  <span className="e-chip e-chip-verified">Confirmé</span>
                )}
                <button
                  type="button"
                  className="e-btn e-btn-ghost"
                  style={{ fontSize: "0.75rem" }}
                  onClick={() =>
                    setRemoved((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.key)) next.delete(row.key);
                      else next.add(row.key);
                      return next;
                    })
                  }
                >
                  {isRemoved ? "Remettre" : "Retirer"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* --- Compléments indispensables ------------------------------------- */}
      <section className="e-card p-4 space-y-3">
        <h2 className="e-display text-lg">Quelques précisions</h2>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Ces trois informations conditionnent la découverte : sans elles, nous ne pouvons pas vous proposer
          de profils pertinents.
        </p>

        <div>
          <label className="e-label" htmlFor="birthDate">
            Date de naissance
          </label>
          <input
            id="birthDate"
            type="date"
            className="e-input"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            required
          />
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Seul votre âge sera visible, jamais votre date de naissance. EDENIA est réservé aux 18 ans et plus.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="e-label" htmlFor="gender">
              Je suis
            </label>
            <select
              id="gender"
              className="e-input"
              value={gender}
              onChange={(event) => setGender(event.target.value as "F" | "M")}
            >
              <option value="F">Une femme</option>
              <option value="M">Un homme</option>
            </select>
          </div>
          <div>
            <label className="e-label" htmlFor="seeking">
              Je recherche
            </label>
            <select
              id="seeking"
              className="e-input"
              value={seeking}
              onChange={(event) => setSeeking(event.target.value as "F" | "M")}
            >
              <option value="M">Un homme</option>
              <option value="F">Une femme</option>
            </select>
          </div>
        </div>

        <div>
          <label className="e-label" htmlFor="city">
            Ville
          </label>
          <select id="city" className="e-input" value={cityId} onChange={(event) => setCityId(event.target.value)}>
            <option value="">Choisir…</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Nous n'affichons jamais d'adresse précise — seulement la ville.
          </p>
        </div>
      </section>

      {/* --- Présentation générée -------------------------------------------- */}
      <section className="e-card p-4">
        <h2 className="e-display text-lg">Ma présentation</h2>
        <p className="text-xs mt-1 mb-2" style={{ color: "var(--fg-muted)" }}>
          Rédigée uniquement à partir de ce que vous avez dit. Modifiez-la librement.
        </p>
        <textarea
          className="e-input"
          rows={4}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          aria-label="Ma présentation"
        />
      </section>

      {generated && generated.toDiscuss.length > 0 && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">À discuter</h2>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Vous n'avez pas encore tranché sur ces sujets. C'est une réponse valable — elle apparaîtra
            telle quelle, sans être interprétée.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {generated.toDiscuss.map((item) => (
              <li key={item.key} className="e-chip">
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          className="e-btn e-btn-primary w-full"
          disabled={busy || !canPublish}
          onClick={() => void submit(true)}
        >
          {busy ? "Enregistrement…" : "Valider et publier mon profil"}
        </button>
        <button
          type="button"
          className="e-btn e-btn-secondary w-full"
          disabled={busy || !birthDate || !cityId}
          onClick={() => void submit(false)}
        >
          Enregistrer sans publier
        </button>
        {!canPublish && pending.length > 0 && (
          <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>
            Confirmez les {pending.length} information{pending.length > 1 ? "s" : ""} en attente pour publier.
          </p>
        )}
      </div>
    </div>
  );
}
