"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dialCodeOptions } from "@/lib/geo/data";
import { phoneRuleFor } from "@/lib/geo/phone";

/**
 * §8 et §62 — étapes 2 et 3 du parcours idéal.
 *
 * Un seul écran, deux onglets, jamais les deux canaux à la fois. Le pays est
 * présélectionné sur le Togo (§4, phase pilote), et la saisie locale
 * (« 90 12 34 56 ») est acceptée : imposer le format international serait une
 * friction inutile.
 */

type Channel = "PHONE" | "EMAIL";
type Step = "DESTINATION" | "CODE";

/**
 * §1 de la phase pilote : seuls les pays lances apparaissent. Aujourd'hui, le
 * Togo seul — le selecteur se replie donc en indicatif fixe. Ouvrir le Benin
 * suffit a le faire reapparaitre, sans toucher a ce composant.
 */
const COUNTRIES = dialCodeOptions();
const SINGLE_COUNTRY = COUNTRIES.length <= 1;
const DEFAULT_COUNTRY = COUNTRIES[0]?.code ?? "TG";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("PHONE");
  const [step, setStep] = useState<Step>("DESTINATION");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [masked, setMasked] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  const dial = country?.dialCode ?? "+228";
  const rule = phoneRuleFor(countryCode);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, destination, countryCode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Demande impossible.");
        return;
      }
      setChallengeId(payload.data.challengeId);
      setMasked(payload.data.maskedDestination);
      setDevCode(payload.data.devCode ?? null);
      setDevMode(Boolean(payload.data.devMode));
      setStep("CODE");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Code incorrect.");
        return;
      }
      router.push(payload.data.next);
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "CODE") {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div>
          <h1 className="e-display text-2xl">Entrez votre code</h1>
          <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
            Nous avons envoyé un code à 6 chiffres à <strong>{masked}</strong>.
          </p>
        </div>

        {devMode && devCode && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{ background: "var(--color-gold-100)", border: "1px solid var(--color-gold-400)", color: "#7a5216" }}
            role="note"
          >
            <p className="font-bold">🟡 OTP — MODE TEST</p>
            <p className="mt-1">
              Aucun SMS n'a été envoyé. Code de test :{" "}
              <strong style={{ fontSize: "1.125rem", letterSpacing: "0.15em" }}>{devCode}</strong>
            </p>
            <p className="mt-1 text-xs">
              En production, un code aléatoire est envoyé par SMS et n'apparaît jamais à l'écran.
            </p>
          </div>
        )}

        <div>
          <label className="e-label" htmlFor="code">
            Code de vérification
          </label>
          <input
            id="code"
            className="e-input text-center tracking-[0.5em] text-lg"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm" role="alert" style={{ color: "var(--color-danger-500)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="e-btn e-btn-primary w-full" disabled={busy || code.length < 4}>
          {busy ? "Vérification…" : "Continuer"}
        </button>

        <button
          type="button"
          className="e-btn e-btn-ghost w-full"
          onClick={() => {
            setStep("DESTINATION");
            setCode("");
            setError(null);
          }}
        >
          Modifier mes coordonnées
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <div>
        <h1 className="e-display text-2xl">
          {mode === "signup" ? "Bienvenue sur EDENIA" : "Content de vous revoir"}
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Un numéro de téléphone <em>ou</em> une adresse e-mail. Pas les deux.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Moyen de contact">
        {(["PHONE", "EMAIL"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={channel === value}
            className={channel === value ? "e-btn e-btn-primary" : "e-btn e-btn-secondary"}
            onClick={() => {
              setChannel(value);
              setDestination("");
              setError(null);
            }}
          >
            {value === "PHONE" ? "Téléphone" : "E-mail"}
          </button>
        ))}
      </div>

      {channel === "PHONE" ? (
        <div>
          <label className="e-label" htmlFor="phone">
            Numéro de téléphone
          </label>
          <div className="flex gap-2">
            {SINGLE_COUNTRY ? (
              <span
                className="e-input inline-flex items-center gap-1.5 shrink-0"
                style={{ width: "auto", background: "var(--bg)" }}
                aria-label={`Pays : ${country?.nameFr ?? "Togo"}`}
              >
                <span aria-hidden="true">{country?.flag}</span>
                <span className="font-semibold">{dial}</span>
              </span>
            ) : (
              <select
                className="e-input"
                style={{ width: "9rem" }}
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                aria-label="Pays"
              >
                {COUNTRIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.dialCode}
                  </option>
                ))}
              </select>
            )}
            <input
              id="phone"
              className="e-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={rule?.placeholder ?? "90 12 34 56"}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }}>
            {SINGLE_COUNTRY
              ? `EDENIA démarre au ${country?.nameFr ?? "Togo"}. ${rule?.hint ?? ""} Format local accepté.`
              : `Format local accepté. Nous complétons avec ${dial}.`}
          </p>
        </div>
      ) : (
        <div>
          <label className="e-label" htmlFor="email">
            Adresse e-mail
          </label>
          <input
            id="email"
            className="e-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            required
          />
        </div>
      )}

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <button type="submit" className="e-btn e-btn-primary w-full" disabled={busy || destination.length < 3}>
        {busy ? "Envoi…" : "Recevoir mon code"}
      </button>

      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
        En continuant, vous acceptez nos{" "}
        <Link href="/conditions" className="underline">
          conditions
        </Link>{" "}
        et notre{" "}
        <Link href="/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        . Réservé aux personnes de 18 ans et plus.
      </p>

      <p className="text-sm text-center" style={{ color: "var(--fg-muted)" }}>
        {mode === "signup" ? (
          <>
            Déjà un compte ?{" "}
            <Link href="/connexion" className="underline">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="underline">
              Créer mon profil
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
