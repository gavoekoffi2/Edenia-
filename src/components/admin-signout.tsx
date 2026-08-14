"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Fin de session d'administration. Distincte de la déconnexion du compte : on
 * ferme le back-office sans quitter EDENIA.
 */
export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    try {
      await fetch("/api/v1/admin/elevate", { method: "DELETE" });
      router.replace("/app/decouvrir");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/app/decouvrir" style={{ color: "var(--fg-muted)" }}>
        Application
      </Link>
      <button
        type="button"
        className="e-btn e-btn-ghost"
        style={{ fontSize: "0.8125rem" }}
        onClick={() => void close()}
        disabled={busy}
      >
        Fermer la session
      </button>
    </div>
  );
}
