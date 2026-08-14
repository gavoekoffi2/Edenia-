"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * §9 — configuration d'un compte interne : mot de passe puis second facteur.
 *
 * Les deux étapes sont soumises ensemble. Un compte qui aurait un mot de passe
 * mais pas de MFA serait un compte à un seul facteur, et personne ne revient
 * jamais terminer une configuration à moitié faite.
 */
export function AdminSetup({
  token,
  displayName,
  roleLabel,
  secret,
  secretDisplay,
  qrSvg,
}: {
  token: string;
  displayName: string;
  roleLabel: string;
  secret: string;
  secretDisplay: string;
  qrSvg: string;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      const response = await fetch("/api/v1/admin/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm, totpSecret: secret, totpCode: code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "La configuration a échoué.");
        setProblems(Array.isArray(payload.problems) ? payload.problems : []);
        return;
      }
      setRecoveryCodes(payload.data.recoveryCodes);
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="e-card p-6">
        <h1 className="e-display text-xl">Vos codes de récupération</h1>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Dix codes à usage unique. Ils sont affichés une seule fois et ne pourront pas être réaffichés :
          notez-les maintenant, hors de votre téléphone. Chacun remplace le code à 6 chiffres si vous
          perdez votre application d&apos;authentification.
        </p>

        <ul className="grid grid-cols-2 gap-2 mt-4 font-mono text-sm">
          {recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode} className="rounded-lg px-3 py-2 text-center" style={{ background: "var(--bg)" }}>
              {recoveryCode}
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-2 mt-5 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1"
          />
          <span>J&apos;ai noté ces codes dans un endroit sûr.</span>
        </label>

        {acknowledged && (
          <Link href="/admin" className="e-btn e-btn-primary w-full mt-4">
            Ouvrir le back-office
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="e-card p-6">
      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
        {roleLabel}
      </p>
      <h1 className="e-display text-xl mt-1">Bonjour {displayName}</h1>
      <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
        Définissez votre mot de passe et activez le second facteur. Les deux sont obligatoires pour
        accéder au back-office.
      </p>

      <fieldset className="border-0 p-0 m-0 mt-6">
        <legend className="font-semibold text-sm">1 · Mot de passe</legend>
        <label className="block mt-2">
          <span className="text-sm">Mot de passe (12 caractères minimum)</span>
          <input
            className="e-input mt-1"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
          />
        </label>
        <label className="block mt-3">
          <span className="text-sm">Confirmation</span>
          <input
            className="e-input mt-1"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
          />
        </label>
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          Une phrase dont vous vous souvenez vaut mieux qu&apos;un mot court avec des symboles.
        </p>
      </fieldset>

      <fieldset className="border-0 p-0 m-0 mt-6">
        <legend className="font-semibold text-sm">2 · Application d&apos;authentification</legend>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Scannez ce code avec Google Authenticator, Aegis, FreeOTP ou équivalent.
        </p>
        <div
          className="mt-3 inline-block rounded-xl p-2"
          style={{ background: "#fff" }}
          // Le SVG est produit côté serveur à partir de notre propre URI otpauth :
          // aucune donnée extérieure n'entre dans ce balisage.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          Si le scan ne fonctionne pas, saisissez la clé manuellement :
        </p>
        <p className="font-mono text-sm mt-1 break-all">{secretDisplay}</p>

        <label className="block mt-4">
          <span className="text-sm">Code à 6 chiffres affiché par l&apos;application</span>
          <input
            className="e-input mt-1"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
          />
        </label>
      </fieldset>

      <button type="submit" className="e-btn e-btn-primary w-full mt-6" disabled={busy || code.length !== 6}>
        {busy ? "…" : "Activer mon compte"}
      </button>

      {error && (
        <div className="mt-3" role="alert">
          <p className="text-sm" style={{ color: "var(--color-danger-500)" }}>
            {error}
          </p>
          {problems.length > 0 && (
            <ul className="text-sm mt-1 list-disc pl-5" style={{ color: "var(--color-danger-500)" }}>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
