import { requirePermission } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * §51 — tableau de bord general.
 *
 * §53 : « le KPI principal doit etre le nombre de connexions significatives
 * creees. » Il est donc affiche en premier, avant le nombre d'inscrits — une
 * plateforme de mariage qui pilote au volume d'inscrits pilote a cote.
 */
export default async function Page() {
  await requirePermission("analytics.read");

  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const [
    users, active30, newUsers30, publishedProfiles, verifiedProfiles,
    matches, conversationsWithReply, openReports, pendingVerifications,
    subscriptions, revenue, byCountry,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE", lastActiveAt: { gte: since30 } } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.profile.count({ where: { isPublished: true } }),
    prisma.profileVerification.count({ where: { status: "APPROVED" } }),
    prisma.match.count({ where: { status: "ACTIVE" } }),
    prisma.conversation.count({ where: { messages: { some: {} }, lastMessageAt: { not: null } } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.verificationRequest.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] } } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { status: "SUCCEEDED" } }),
    prisma.profile.groupBy({ by: ["countryCode"], _count: true, where: { isPublished: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="e-display text-2xl">Tableau de bord</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          30 derniers jours.
        </p>
      </div>

      <section>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-clay-500)" }}>
          KPI principal — connexions significatives
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Conversations engagées" value={conversationsWithReply} hint="Au moins un message échangé" primary />
          <Stat label="Matchs actifs" value={matches} />
          <Stat label="Profils vérifiés" value={verifiedProfiles} />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          §53 : le volume d'inscrits n'est pas l'objectif. Ce qui compte, ce sont les relations réellement
          engagées — et, à terme, les mariages déclarés volontairement.
        </p>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>
          Activité
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Membres actifs" value={users} />
          <Stat label="Actifs sur 30 j" value={active30} />
          <Stat label="Nouveaux (30 j)" value={newUsers30} />
          <Stat label="Profils publiés" value={publishedProfiles} />
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>
          À traiter
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Signalements ouverts" value={openReports} alert={openReports > 0} />
          <Stat label="Vérifications en attente" value={pendingVerifications} alert={pendingVerifications > 5} />
          <Stat label="Abonnements actifs" value={subscriptions} />
          <Stat label="Revenus (FCFA)" value={revenue._sum.amountCents ?? 0} />
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>
          Densité par pays
        </p>
        <div className="e-card p-4">
          <ul className="space-y-1.5 text-sm">
            {byCountry.map((row) => (
              <li key={row.countryCode ?? "?"} className="flex justify-between">
                <span>{row.countryCode ?? "Non renseigné"}</span>
                <span className="font-semibold">{row._count}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
            §4 : n'ouvrir un nouveau pays qu'une fois la densité atteinte sur le précédent.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  primary,
  alert,
}: {
  label: string;
  value: number;
  hint?: string;
  primary?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="e-card p-4" style={alert ? { borderColor: "var(--color-danger-500)" } : undefined}>
      <p className={primary ? "e-display text-3xl" : "e-display text-2xl"}>{value.toLocaleString("fr-FR")}</p>
      <p className="text-sm mt-0.5">{label}</p>
      {hint && (
        <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
