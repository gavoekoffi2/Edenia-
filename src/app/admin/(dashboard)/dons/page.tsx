import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { donationSummary } from "@/lib/donations/service";
import { formatXof } from "@/lib/premium/entitlements";
import { STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";

export const metadata = { title: "Dons", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §4, §5 — suivi des dons.
 *
 * Cette page est financière, et rien d'autre. Elle n'expose ni classement de
 * donateurs, ni export vers un outil de segmentation : dès qu'une équipe peut
 * trier ses membres par montant donné, elle finit par les traiter différemment.
 * Le seul lien avec le compte est celui qu'exige la comptabilité.
 */
export default async function Page() {
  await requireAdminPage("donations.read");

  const [summary, donations] = await Promise.all([
    donationSummary(),
    prisma.donation.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        orderRef: true,
        amountCents: true,
        currency: true,
        status: true,
        gateway: true,
        environment: true,
        isAnonymous: true,
        donorName: true,
        message: true,
        createdAt: true,
        completedAt: true,
        userId: true,
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Dons</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Soutien volontaire. Aucun avantage n&apos;y est attaché — ni badge, ni visibilité, ni priorité.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total confirmé" value={formatXof(summary.amountTotal)} />
        <Stat label="30 derniers jours" value={formatXof(summary.amount30)} />
        <Stat label="Dons confirmés" value={summary.completed.toLocaleString("fr-FR")} />
        <Stat label="Donateurs distincts" value={summary.distinctDonors.toLocaleString("fr-FR")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="En cours" value={summary.pending.toLocaleString("fr-FR")} />
        <Stat label="Échoués ou annulés" value={summary.failed.toLocaleString("fr-FR")} />
      </div>

      <section>
        <h2 className="e-display text-lg mb-2">Derniers dons</h2>
        {donations.length === 0 ? (
          <p className="e-card p-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
            Aucun don enregistré.
          </p>
        ) : (
          <ul className="space-y-2">
            {donations.map((donation) => (
              <li key={donation.id} className="e-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {donation.isAnonymous ? "Donateur anonyme" : (donation.donorName ?? "Membre EDENIA")}
                      {donation.environment !== "live" && (
                        <span className="e-chip ml-2">{donation.environment}</span>
                      )}
                      {donation.gateway === "SIMULATED" && <span className="e-chip ml-1">simulé</span>}
                    </p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--fg-muted)" }}>
                      {donation.orderRef}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                      {donation.createdAt.toLocaleString("fr-FR")}
                      {donation.completedAt && ` · confirmé le ${donation.completedAt.toLocaleDateString("fr-FR")}`}
                      {donation.userId ? " · rattaché à un compte" : " · sans compte"}
                    </p>
                    {donation.message && (
                      <p className="text-sm mt-1.5 italic">« {donation.message} »</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatXof(donation.amountCents)}</p>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {STATUS_LABEL[donation.status as PaymentStatus] ?? donation.status}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="e-card p-4">
      <p className="e-display text-xl">{value}</p>
      <p className="text-sm mt-0.5">{label}</p>
    </div>
  );
}
