import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";

export const metadata = { title: "Journal d'audit", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * §47 — journal d'audit.
 *
 * Les identifiants y sont pseudonymisés, y compris ceux des administrateurs :
 * le journal sert à reconstituer une séquence d'événements, pas à surveiller
 * des personnes. Il survit à la suppression d'un compte, ce qui est justement
 * la raison pour laquelle il ne doit contenir aucune donnée directement
 * identifiante.
 *
 * Le journal nominatif des décisions internes est ailleurs — `AdminAction`,
 * affiché plus bas — parce qu'une sanction doit pouvoir être rattachée à celui
 * qui l'a prononcée.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; page?: string }>;
}) {
  await requireAdminPage("audit.read");
  const { e, page } = await searchParams;

  const current = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const where = e ? { event: e } : {};

  const [total, entries, events, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.groupBy({ by: ["event"], _count: true, orderBy: { _count: { event: "desc" } }, take: 14 }),
    prisma.adminAction.findMany({
      include: { admin: { select: { displayName: true, roleCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Journal d&apos;audit</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {total.toLocaleString("fr-FR")} entrée(s). Les identifiants sont pseudonymisés — le journal
          reconstitue des séquences, il ne surveille personne.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filtrer par événement">
        <Link
          href="/admin/journal"
          className={e ? "e-chip" : "e-chip e-chip-gold"}
          style={{ cursor: "pointer" }}
        >
          Tous
        </Link>
        {events.map((row) => (
          <Link
            key={row.event}
            href={`/admin/journal?e=${encodeURIComponent(row.event)}`}
            className={e === row.event ? "e-chip e-chip-gold" : "e-chip"}
            style={{ cursor: "pointer" }}
          >
            {row.event} ({row._count})
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="e-display text-lg mb-2">Décisions internes</h2>
        {actions.length === 0 ? (
          <p className="e-card p-4 text-sm" style={{ color: "var(--fg-muted)" }}>
            Aucune décision enregistrée.
          </p>
        ) : (
          <ul className="e-card divide-y" style={{ borderColor: "var(--border)" }}>
            {actions.map((action) => (
              <li key={action.id} className="p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{action.action}</span>
                  <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    {action.createdAt.toLocaleString("fr-FR")}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                  {action.admin.displayName} ({action.admin.roleCode}) · {action.targetType} ·{" "}
                  <span className="font-mono">{action.targetId.slice(0, 10)}…</span>
                </p>
                {action.reason && <p className="text-xs mt-1">{action.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="e-display text-lg mb-2">Événements système</h2>
        {entries.length === 0 ? (
          <p className="e-card p-4 text-sm" style={{ color: "var(--fg-muted)" }}>
            Aucune entrée.
          </p>
        ) : (
          <ul className="e-card divide-y" style={{ borderColor: "var(--border)" }}>
            {entries.map((entry) => (
              <li key={entry.id} className="p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{entry.event}</span>
                  <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    {entry.createdAt.toLocaleString("fr-FR")}
                  </span>
                </div>
                <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--fg-muted)" }}>
                  {entry.actorType} · {entry.actorRef.slice(0, 12)}…
                  {entry.targetRef && ` → ${entry.targetRef.slice(0, 12)}…`}
                </p>
                {entry.metadata && (
                  <p className="text-xs mt-1 break-all" style={{ color: "var(--fg-muted)" }}>
                    {entry.metadata.slice(0, 300)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pages > 1 && (
        <nav className="flex justify-between text-sm" aria-label="Pagination">
          {current > 1 ? <Link href={href(e, current - 1)}>← Précédent</Link> : <span />}
          <span style={{ color: "var(--fg-muted)" }}>
            Page {current} / {pages}
          </span>
          {current < pages ? <Link href={href(e, current + 1)}>Suivant →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

function href(event: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (event) params.set("e", event);
  params.set("page", String(page));
  return `/admin/journal?${params.toString()}`;
}
