"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dialCodeOptions } from "@/lib/geo/data";

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

const COUNTRIES = dialCodeOptions();

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("PHONE");
  const [step, setStep] = useState<Step>("DESTINATION");
  const [countryCode, setCountryCode] = useState("TG");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [masked, setMasked] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dial = COUNTRIES.find((c) => c.code === countryCode)?.dialCode ?? "+228";

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

        {devCode && (
          <p className="text-sm rounded-xl p-3" style={{ background: "var(--color-sand-200)" }}>
            Mode développement — code : <strong>{devCode}</strong>
          </p>
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
            <select
              className="e-input"
              style={{ width: "9rem" }}
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              aria-label="Pays"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.dialCode}
                </option>
              ))}
            </select>
            <input
              id="phone"
              className="e-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="90 12 34 56"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }}>
            Format local accepté. Nous complétons avec {dial}.
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
