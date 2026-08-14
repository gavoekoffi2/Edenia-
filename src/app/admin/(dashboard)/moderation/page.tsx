import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { REPORT_CATEGORY_LABEL, type ReportCategory } from "@/lib/config/enums";
import { SLA_HOURS, recommendSanction, reportPriority } from "@/lib/moderation/sanctions";
import { computeTrustScore, trustBand } from "@/lib/trust/signals";
import { ModerationDecision } from "@/components/admin-moderation";

export const dynamic = "force-dynamic";

/** §35 — file de signalements, triee par gravite puis par anciennete. */
export default async function Page() {
  await requireAdminPage("reports.read");

  const reports = await prisma.report.findMany({
    where: { status: { in: ["OPEN", "TRIAGED"] } },
    include: {
      reported: {
        select: {
          id: true,
          createdAt: true,
          phoneVerified: true,
          trustScore: true,
          profile: { select: { firstName: true, city: { select: { nameFr: true } } } },
          trustSignals: { orderBy: { createdAt: "desc" }, take: 10 },
          identityVerification: { select: { status: true } },
          profileVerification: { select: { status: true } },
          reportsReceived: { select: { id: true, outcome: true } },
        },
      },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
    take: 50,
  });

  const [flaggedMessages, photosWaiting] = await Promise.all([
    prisma.message.count({ where: { flagged: true } }),
    prisma.photo.count({ where: { moderationStatus: { in: ["PENDING", "REVIEW_REQUIRED"] } } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Modération</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {reports.length} signalement{reports.length > 1 ? "s" : ""} à traiter · {flaggedMessages} message
          {flaggedMessages > 1 ? "s" : ""} détecté{flaggedMessages > 1 ? "s" : ""} automatiquement.
        </p>
      </div>

      {photosWaiting > 0 && (
        <p className="e-card p-3 text-sm">
          {photosWaiting} photo(s) attendent un examen.{" "}
          <Link href="/admin/profils" className="underline">
            Ouvrir la file des profils
          </Link>
        </p>
      )}

      <h2 className="e-display text-lg">Signalements</h2>

      {reports.length === 0 ? (
        <p className="e-card p-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Aucun signalement en attente.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const priority = reportPriority(report.category as ReportCategory);
            const history = report.reported.reportsReceived
              .map((r) => r.outcome)
              .filter((outcome): outcome is string => Boolean(outcome) && outcome !== "NO_ACTION");

            const score = computeTrustScore({
              signals: report.reported.trustSignals.map((signal) => ({
                kind: signal.kind as never,
                weight: signal.weight,
                createdAt: signal.createdAt,
              })),
              phoneVerified: report.reported.phoneVerified,
              identityVerified: report.reported.identityVerification?.status === "APPROVED",
              profileVerified: report.reported.profileVerification?.status === "APPROVED",
              accountAgeDays: Math.floor((Date.now() - report.reported.createdAt.getTime()) / 86_400_000),
              reportsReceived: report.reported.reportsReceived.length,
            });

            const recommendation = recommendSanction({
              category: report.category as ReportCategory,
              history: history as never,
              confirmed: true,
              recentConfirmedReports: history.length,
            });

            return (
              <article key={report.id} className="e-card p-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {REPORT_CATEGORY_LABEL[report.category as ReportCategory]} —{" "}
                      {report.reported.profile?.firstName ?? "Profil sans nom"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                      Signalé le {report.createdAt.toLocaleDateString("fr-FR")} · délai cible{" "}
                      {SLA_HOURS[priority]} h · {report.reported.profile?.city?.nameFr ?? "ville inconnue"}
                    </p>
                  </div>
                  <span
                    className="e-chip shrink-0"
                    style={
                      priority === "CRITICAL" || priority === "HIGH"
                        ? { borderColor: "var(--color-danger-500)", color: "var(--color-danger-500)" }
                        : undefined
                    }
                  >
                    {priority}
                  </span>
                </header>

                {report.detail && <p className="text-sm mt-2">{report.detail}</p>}

                {/* §34 : le trust score est visible ici, et nulle part ailleurs. */}
                <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--bg)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                    Contexte interne (jamais visible par les membres)
                  </p>
                  <p className="mt-1.5">
                    Trust score : <strong>{score}</strong> ({trustBand(score)}) · {history.length} sanction
                    {history.length > 1 ? "s" : ""} antérieure{history.length > 1 ? "s" : ""}
                  </p>
                  {report.reported.trustSignals.length > 0 && (
                    <ul className="mt-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                      {report.reported.trustSignals.slice(0, 4).map((signal) => (
                        <li key={signal.id}>
                          · {signal.kind} ({signal.weight}) — {signal.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs">
                    <strong>Recommandation :</strong> {recommendation.sanction} — {recommendation.rationale}
                    {recommendation.requiresHumanReview && " Décision humaine obligatoire."}
                  </p>
                </div>

                <ModerationDecision reportId={report.id} recommended={recommendation.sanction} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
