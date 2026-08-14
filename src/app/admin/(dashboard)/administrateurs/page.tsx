import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { ROLES, ROLE_LABEL, permissionsFor, type Role } from "@/lib/auth/rbac";
import { AdminTeam } from "@/components/admin-team";

export const metadata = { title: "Administrateurs", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §36 — l'équipe interne.
 *
 * Créer un collègue ne demande jamais d'accès à la base : on saisit l'adresse
 * e-mail de son compte membre, on choisit son rôle, et l'interface produit un
 * lien de configuration à usage unique. Le mot de passe n'existe qu'après que
 * l'intéressé l'a choisi, et personne d'autre ne le voit — pas même
 * l'administrateur principal.
 */
export default async function Page() {
  const admin = await requireAdminPage("admins.manage");

  const [admins, roles] = await Promise.all([
    prisma.adminUser.findMany({
      include: { user: { select: { email: true, phone: true, status: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adminRole.findMany({ orderBy: { code: "asc" } }),
  ]);

  const assignable = (ROLES as readonly string[]).filter(
    (role) => role !== "USER" && (admin.role === "SUPER_ADMIN" || role !== "SUPER_ADMIN"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="e-display text-2xl">Administrateurs</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {admins.length} compte(s) interne(s). Chacun a son propre mot de passe et son propre second
          facteur — aucun compte partagé.
        </p>
      </div>

      <AdminTeam
        selfId={admin.adminId}
        selfRole={admin.role}
        assignableRoles={assignable.map((role) => ({ code: role, label: ROLE_LABEL[role as Role] ?? role }))}
        members={admins.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          roleCode: member.roleCode,
          roleLabel: ROLE_LABEL[member.roleCode as Role] ?? member.roleCode,
          email: member.user.email,
          isActive: member.isActive,
          configured: member.passwordHash !== null && member.mfaEnabledAt !== null,
          lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
          lockedUntil:
            member.lockedUntil && member.lockedUntil.getTime() > Date.now()
              ? member.lockedUntil.toISOString()
              : null,
        }))}
      />

      <section>
        <h2 className="e-display text-lg mb-2">Ce que chaque rôle peut faire</h2>
        <div className="e-card p-4">
          <ul className="space-y-3 text-sm">
            {roles
              .filter((role) => role.code !== "USER")
              .map((role) => {
                const permissions = permissionsFor(role.code);
                return (
                  <li key={role.code}>
                    <p className="font-semibold">{ROLE_LABEL[role.code as Role] ?? role.nameFr}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                      {permissions.length === 0 ? "Aucune permission." : permissions.join(" · ")}
                    </p>
                  </li>
                );
              })}
          </ul>
          <p className="text-xs mt-4" style={{ color: "var(--fg-muted)" }}>
            §36 : refus par défaut. Une permission absente de cette liste est refusée, sans héritage
            implicite. L&apos;agent de vérification ne voit ni les conversations, ni les paiements — ce
            périmètre étroit est voulu.
          </p>
        </div>
      </section>
    </div>
  );
}
