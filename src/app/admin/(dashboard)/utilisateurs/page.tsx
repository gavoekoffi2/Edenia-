import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { adminCan } from "@/lib/admin/service";
import { prisma } from "@/lib/db/client";
import { ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { AdminUserActions } from "@/components/admin-user-actions";

export const metadata = { title: "Utilisateurs", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "Inscription en cours",
  SUSPENDED: "Suspendu",
  BANNED: "Banni",
  DELETED: "Supprimé",
};

/**
 * §35 — liste des membres.
 *
 * Les coordonnées ne s'affichent que pour les rôles qui portent
 * `users.read_sensitive`. Un modérateur travaille sur des comportements, pas
 * sur des numéros de téléphone : lui montrer les coordonnées de tout le monde
 * serait une collecte inutile, au sens du §47.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  const admin = await requireAdminPage("users.read");
  const { q, statut, page } = await searchParams;

  const canSeeSensitive = adminCan(admin, "users.read_sensitive");
  const canSuspend = adminCan(admin, "users.suspend");
  const canBan = adminCan(admin, "users.ban");

  const current = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const search = q?.trim() ?? "";

  const where = {
    AND: [
      statut && STATUS_LABEL[statut] ? { status: statut } : {},
      search
        ? {
            OR: [
              { profile: { firstName: { contains: search } } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {},
    ],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        role: true,
        status: true,
        email: true,
        phone: true,
        createdAt: true,
        lastActiveAt: true,
        profile: { select: { firstName: true, isPublished: true, countryCode: true, completeness: true } },
        _count: { select: { reportsReceived: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="e-display text-2xl">Utilisateurs</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {total.toLocaleString("fr-FR")} compte(s).
          {!canSeeSensitive && " Les coordonnées sont masquées pour votre rôle."}
        </p>
      </div>

      <form className="e-card p-3 flex flex-wrap gap-2 items-end" method="get">
        <label className="flex-1 min-w-[12rem]">
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Rechercher
          </span>
          <input className="e-input mt-1" name="q" defaultValue={search} placeholder="Prénom, e-mail, téléphone" />
        </label>
        <label>
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Statut
          </span>
          <select className="e-input mt-1" name="statut" defaultValue={statut ?? ""}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="e-btn e-btn-secondary">
          Filtrer
        </button>
      </form>

      {users.length === 0 ? (
        <div className="e-card p-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Aucun compte ne correspond.
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user.id} className="e-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {user.profile?.firstName ?? "Profil non créé"}
                    {user.role !== "USER" && (
                      <span className="e-chip ml-2">{ROLE_LABEL[user.role as Role] ?? user.role}</span>
                    )}
                    {user._count.reportsReceived > 0 && (
                      <span className="e-chip ml-2" style={{ color: "var(--color-danger-500)" }}>
                        {user._count.reportsReceived} signalement(s)
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {STATUS_LABEL[user.status] ?? user.status}
                    {" · "}
                    inscrit le {user.createdAt.toLocaleDateString("fr-FR")}
                    {user.lastActiveAt && ` · vu le ${user.lastActiveAt.toLocaleDateString("fr-FR")}`}
                    {user.profile?.countryCode && ` · ${user.profile.countryCode}`}
                    {user.profile && ` · profil ${user.profile.completeness} %`}
                    {user.profile?.isPublished ? " · publié" : ""}
                  </p>
                  {canSeeSensitive && (
                    <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--fg-muted)" }}>
                      {user.email ?? "—"} · {user.phone ?? "—"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {user.profile?.isPublished && (
                    <Link href={`/app/profils/${user.id}`} className="e-btn e-btn-ghost" style={{ fontSize: "0.75rem" }}>
                      Voir
                    </Link>
                  )}
                  <AdminUserActions
                    userId={user.id}
                    status={user.status}
                    canSuspend={canSuspend}
                    canBan={canBan}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex justify-between text-sm" aria-label="Pagination">
          {current > 1 ? (
            <Link href={buildHref(search, statut, current - 1)}>← Précédent</Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--fg-muted)" }}>
            Page {current} / {pages}
          </span>
          {current < pages ? <Link href={buildHref(search, statut, current + 1)}>Suivant →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

function buildHref(q: string, statut: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (statut) params.set("statut", statut);
  params.set("page", String(page));
  return `/admin/utilisateurs?${params.toString()}`;
}
