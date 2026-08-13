import { requirePermission } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { CHECKLISTS, DOCUMENT_RETENTION_DAYS, LEVELS, churchQuestion } from "@/lib/verification/levels";
import { VerificationDecision } from "@/components/admin-verification";

export const dynamic = "force-dynamic";

/**
 * §52 — tableau de bord de verification.
 *
 * Ce qui n'apparait volontairement PAS ici : les conversations, les matchs,
 * les paiements, le trust score. Le §36 impose que l'agent n'ait acces qu'a ce
 * dont il a besoin pour decider.
 */
export default async function Page() {
  await requirePermission("verification.read");

  const requests = await prisma.verificationRequest.findMany({
    where: { status: { in: ["PENDING", "IN_REVIEW", "NEED_MORE_INFO"] } },
    include: {
      user: {
        select: {
          id: true,
          phoneVerified: true,
          emailVerified: true,
          createdAt: true,
          profile: {
            select: {
              firstName: true,
              birthDate: true,
              profession: true,
              city: { select: { nameFr: true } },
              country: { select: { nameFr: true } },
            },
          },
          churchVerification: { include: { church: { select: { name: true } } } },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  const decided = await prisma.verificationRequest.count({ where: { status: { in: ["APPROVED", "REJECTED"] } } });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Vérification</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {requests.length} dossier{requests.length > 1 ? "s" : ""} en attente · {decided} traité
          {decided > 1 ? "s" : ""} au total.
        </p>
      </div>

      <div className="e-card p-4 text-sm">
        <p className="font-semibold">Rappels</p>
        <ul className="mt-2 space-y-1" style={{ color: "var(--fg-muted)" }}>
          <li>· Une approbation exige que <strong>tous</strong> les points de la liste soient vérifiés.</li>
          <li>· Un refus doit être motivé : la personne recevra votre explication.</li>
          <li>· Les pièces d'identité sont détruites au plus tard {DOCUMENT_RETENTION_DAYS} jours après la décision.</li>
          <li>· Un paiement ne donne aucune priorité et n'ouvre aucun droit à un badge.</li>
        </ul>
      </div>

      {requests.length === 0 ? (
        <p className="e-card p-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Aucun dossier en attente.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const kind = request.kind as "IDENTITY" | "PROFILE" | "CHURCH";
            const profile = request.user.profile;
            const age = profile
              ? Math.floor((Date.now() - profile.birthDate.getTime()) / (365.25 * 86_400_000))
              : null;

            return (
              <article key={request.id} className="e-card p-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {LEVELS[kind].icon} {LEVELS[kind].label} — {profile?.firstName ?? "Sans profil"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                      {age !== null && `${age} ans · `}
                      {[profile?.city?.nameFr, profile?.country?.nameFr].filter(Boolean).join(", ")}
                      {profile?.profession && ` · ${profile.profession}`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                      Compte créé le {request.user.createdAt.toLocaleDateString("fr-FR")} ·
                      {request.user.phoneVerified ? " téléphone vérifié" : ""}
                      {request.user.emailVerified ? " e-mail vérifié" : ""}
                    </p>
                  </div>
                  <span className="e-chip shrink-0">{request.status}</span>
                </header>

                {age !== null && age < 18 && (
                  <p
                    className="mt-3 rounded-xl p-3 text-sm"
                    style={{ background: "var(--color-danger-100)", color: "#7a2b23" }}
                  >
                    ⚠️ Âge déclaré inférieur à 18 ans. Suspendre le compte immédiatement, sans exception.
                  </p>
                )}

                {kind === "CHURCH" && request.user.churchVerification?.church && (
                  <details className="mt-3">
                    <summary className="text-sm font-semibold cursor-pointer">
                      Message à envoyer à {request.user.churchVerification.church.name}
                    </summary>
                    <pre
                      className="mt-2 text-xs whitespace-pre-wrap rounded-xl p-3"
                      style={{ background: "var(--bg)", fontFamily: "inherit" }}
                    >
                      {churchQuestion(profile?.firstName ?? "cette personne", profile?.city?.nameFr ?? null)}
                    </pre>
                    <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                      Ne posez aucune autre question. Ne consignez aucune information supplémentaire.
                    </p>
                  </details>
                )}

                <VerificationDecision
                  requestId={request.id}
                  kind={kind}
                  checklist={CHECKLISTS[kind]}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
