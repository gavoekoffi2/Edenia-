"use client";

import { useState } from "react";

/**
 * §42 — paiement Mobile Money. Le numéro payeur est demandé parce que c'est
 * ainsi que fonctionnent T-Money, Flooz, MTN MoMo et Wave : la confirmation
 * arrive sur le téléphone, pas dans le navigateur.
 */
export function CheckoutForm({
  planCode,
  methods,
}: {
  planCode: string;
  methods: Array<{ code: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(methods[0]?.code ?? "SIMULATED");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode, provider: method, payerPhone: phone }),
      });
      const payload = await response.json();
      setMessage(payload.data?.userInstruction ?? payload.data?.message ?? payload.error ?? "Paiement initié.");
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="e-btn e-btn-primary w-full mt-3" onClick={() => setOpen(true)}>
        Choisir cette offre
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <select className="e-input" value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Moyen de paiement">
        {methods.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>

      <input
        className="e-input"
        type="tel"
        inputMode="tel"
        placeholder="Numéro Mobile Money"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        aria-label="Numéro payeur"
      />

      <button type="button" className="e-btn e-btn-primary w-full" onClick={() => void pay()} disabled={busy || !phone}>
        {busy ? "Traitement…" : "Payer"}
      </button>

      {message && (
        <p className="text-sm" role="status" style={{ color: "var(--fg-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
