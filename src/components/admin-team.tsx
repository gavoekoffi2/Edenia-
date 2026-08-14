"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TeamMember {
  id: string;
  displayName: string;
  roleCode: string;
  roleLabel: string;
  email: string | null;
  isActive: boolean;
  configured: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

/**
 * §36 — gestion de l'équipe interne.
 *
 * Le lien de configuration s'affiche une seule fois, ici, à l'écran. Il n'est
 * pas envoyé par e-mail depuis cette page : la passerelle e-mail n'est pas
 * branchée, et faire croire qu'un message est parti serait pire que de demander
 * à l'administrateur de transmettre le lien lui-même.
 */
export function AdminTeam({
  selfId,
  selfRole,
  assignableRoles,
  members,
}: {
  selfId: string;
  selfRole: string;
  assignableRoles: Array<{ code: string; label: string }>;
  members: TeamMember[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleCode, setRoleCode] = useState(assignableRoles[0]?.code ?? "MODERATOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string; who: string } | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const response = await fetch("/api/v1/admin/administrators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), displayName: displayName.trim(), roleCode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Invitation impossible.");
        return;
      }
      setLink({ url: payload.data.url, expiresAt: payload.data.expiresAt, who: displayName.trim() });
      setEmail("");
      setDisplayName("");
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "enable" | "disable" | "reset" | "role", roleValue?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/administrators", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminUserId: id, action, roleCode: roleValue }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Action impossible.");
        return;
      }
      if (payload.data.url) {
        const member = members.find((item) => item.id === id);
        setLink({ url: payload.data.url, expiresAt: payload.data.expiresAt, who: member?.displayName ?? "" });
      }
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {link && (
        <div className="e-card p-4" style={{ borderColor: "var(--color-gold-400)" }}>
          <p className="font-semibold text-sm">Lien de configuration pour {link.who}</p>
          <p className="font-mono text-xs mt-2 break-all">{link.url}</p>
          <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
            Valable jusqu&apos;au {new Date(link.expiresAt).toLocaleString("fr-FR")}, utilisable une seule
            fois. Transmettez-le par un canal sûr. Il ne sera plus jamais affiché — si vous le perdez,
            réinitialisez le compte pour en générer un autre.
          </p>
        </div>
      )}

      <form onSubmit={invite} className="e-card p-4">
        <h2 className="e-display text-lg">Ajouter un administrateur</h2>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          La personne doit déjà avoir un compte membre EDENIA avec cette adresse e-mail.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <label>
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Adresse e-mail du compte
            </span>
            <input
              className="e-input mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Nom affiché
            </span>
            <input
              className="e-input mt-1"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Rôle
            </span>
            <select
              className="e-input mt-1"
              value={roleCode}
              onChange={(event) => setRoleCode(event.target.value)}
            >
              {assignableRoles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="e-btn e-btn-primary mt-3" disabled={busy}>
          {busy ? "…" : "Générer le lien de configuration"}
        </button>
      </form>

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {members.map((member) => {
          const isSelf = member.id === selfId;
          const canTouch = !isSelf && (selfRole === "SUPER_ADMIN" || member.roleCode !== "SUPER_ADMIN");
          return (
            <li key={member.id} className="e-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {member.displayName}
                    <span className="e-chip ml-2">{member.roleLabel}</span>
                    {isSelf && <span className="e-chip ml-1">vous</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {member.email ?? "—"}
                    {" · "}
                    {!member.isActive
                      ? "désactivé"
                      : !member.configured
                        ? "configuration en attente"
                        : "actif"}
                    {member.lastLoginAt &&
                      ` · dernière ouverture le ${new Date(member.lastLoginAt).toLocaleDateString("fr-FR")}`}
                  </p>
                  {member.lockedUntil && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-danger-500)" }}>
                      Verrouillé jusqu&apos;à {new Date(member.lockedUntil).toLocaleTimeString("fr-FR")} après
                      trop de tentatives.
                    </p>
                  )}
                </div>

                {canTouch && (
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    <select
                      className="e-input"
                      style={{ maxWidth: "11rem", minHeight: "2.25rem", fontSize: "0.8125rem" }}
                      value={member.roleCode}
                      disabled={busy}
                      onChange={(event) => void act(member.id, "role", event.target.value)}
                      aria-label={`Rôle de ${member.displayName}`}
                    >
                      {assignableRoles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="e-btn e-btn-ghost"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => void act(member.id, "reset")}
                      disabled={busy}
                    >
                      Réinitialiser
                    </button>
                    <button
                      type="button"
                      className="e-btn e-btn-ghost"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => void act(member.id, member.isActive ? "disable" : "enable")}
                      disabled={busy}
                    >
                      {member.isActive ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
