"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEALBREAKER_KEY, DEALBREAKER_LABEL, SCOPE } from "@/lib/config/enums";

const SCOPE_LABEL: Record<string, string> = {
  CITY: "Ma ville",
  REGION: "Ma région",
  COUNTRY: "Mon pays",
  FRANCOPHONE_AFRICA: "Afrique francophone",
  INTERNATIONAL: "International",
  DIASPORA: "Diaspora",
};

/**
 * §22 — l'écran où l'utilisateur distingue explicitement ses **préférences**
 * (qui pondèrent le score) de ses **critères essentiels** (qui éliminent).
 * La différence est écrite en toutes lettres, parce qu'elle change tout.
 */
export function PreferencesForm({
  initial,
  dealbreakers,
}: {
  initial: { ageMin: number; ageMax: number; scope: string; openToDiaspora: boolean; openToChildren: boolean };
  dealbreakers: string[];
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set(dealbreakers));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const response = await fetch("/api/v1/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...state, dealbreakers: [...selected] }),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="e-card p-4 space-y-4">
      <div>
        <h2 className="e-display text-lg">Mes préférences</h2>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Une préférence oriente vos recommandations sans exclure personne.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="e-label" htmlFor="ageMin">Âge minimum</label>
          <input
            id="ageMin"
            type="number"
            min={18}
            max={99}
            className="e-input"
            value={state.ageMin}
            onChange={(event) => setState((s) => ({ ...s, ageMin: Number(event.target.value) }))}
          />
        </div>
        <div>
          <label className="e-label" htmlFor="ageMax">Âge maximum</label>
          <input
            id="ageMax"
            type="number"
            min={18}
            max={99}
            className="e-input"
            value={state.ageMax}
            onChange={(event) => setState((s) => ({ ...s, ageMax: Number(event.target.value) }))}
          />
        </div>
      </div>

      <div>
        <label className="e-label" htmlFor="scope">Zone de recherche</label>
        <select
          id="scope"
          className="e-input"
          value={state.scope}
          onChange={(event) => setState((s) => ({ ...s, scope: event.target.value }))}
        >
          {SCOPE.map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABEL[scope] ?? scope}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.openToDiaspora}
          onChange={(event) => setState((s) => ({ ...s, openToDiaspora: event.target.checked }))}
        />
        Ouvert(e) à une relation avec la diaspora
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.openToChildren}
          onChange={(event) => setState((s) => ({ ...s, openToChildren: event.target.checked }))}
        />
        Ouvert(e) à quelqu'un qui a déjà des enfants
      </label>

      <hr style={{ borderColor: "var(--border)" }} />

      <div>
        <h3 className="font-semibold text-sm">Mes critères essentiels</h3>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Un critère essentiel est <strong>éliminatoire</strong> : les personnes qui n'y répondent pas ne
          vous seront pas proposées, et vous ne leur serez pas proposé(e) non plus. À utiliser avec parcimonie
          — chaque critère réduit sensiblement le nombre de rencontres possibles.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {DEALBREAKER_KEY.map((key) => {
            const active = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                className={active ? "e-chip e-chip-gold" : "e-chip"}
                style={{ cursor: "pointer" }}
                aria-pressed={active}
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
              >
                {DEALBREAKER_LABEL[key]}
              </button>
            );
          })}
        </div>
        {selected.size >= 4 && (
          <p className="text-xs mt-2" style={{ color: "var(--color-danger-500)" }}>
            {selected.size} critères essentiels : votre découverte va devenir très étroite.
          </p>
        )}
      </div>

      <button type="button" className="e-btn e-btn-primary w-full" onClick={() => void save()} disabled={busy}>
        {busy ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </section>
  );
}
