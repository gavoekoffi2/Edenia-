import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/auth/rbac";
import { landingSection } from "@/lib/admin/sections";
import { adminGate } from "@/lib/admin/service";
import { activationFunnel, activeUsers, engagementRates, moderationLoad } from "@/lib/admin/stats";
import { donationSummary } from "@/lib/donations/service";
import { donationsEnabled, monetizationLabel, premiumIsPublic } from "@/lib/config/monetization";
import { prisma } from "@/lib/db/client";
import { formatXof } from "@/lib/premium/entitlements";

export const dynamic = "force-dynamic";

/**
 * §51, §53 — tableau de bord.
 *
 * Ordre voulu : d'abord ce que la plateforme produit (des conversations), puis
 * l'activation, puis la charge de travail. Les inscriptions arrivent en
 * dernier — c'est le chiffre qu'on regarde quand on ne sait pas quoi regarder.
 */
export default async function Page() {
  // Un agent de vérification n'a pas « analytics.read » : plutôt qu'un refus,
  // on l'envoie là où il a effectivement du travail.
  const gate = await adminGate();
  if (gate.state === "READY" && !can(gate.context.role, "analytics.read")) {
    redirect(landingSection(gate.context.role));
  }

  await requireAdminPage("analytics.read");

  const [active, funnel, rates, load, byCountry, donations] = await Promise.all([
    activeUsers(),
    activationFunnel(),
    engagementRates(),
    moderationLoad(),
    prisma.profile.groupBy({ by: ["countryCode"], _count: true, where: { isPublished: true } }),
    donationsEnabled ? donationSummary() : null,
  ]);

  const signups = funnel.find((step) => step.key === "signup")?.count ?? 0;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="e-display text-2xl">Tableau de bord</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {monetizationLabel()}
          {premiumIsPublic ? "" : " — les abonnements ne sont pas proposés aux membres."}
        </p>
      </div>

      <section>
        <SectionLabel accent>KPI principal — connexions significatives</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Conversations engagées"
            value={rates.conversationsWithMessage}
            hint="Au moins un message échangé"
            primary
          />
          <Stat label="Matchs" value={rates.matches} />
          <Stat
            label="Réciprocité"
            value={rates.mutualConversationRate}
            suffix=" %"
            hint="Matchs où les deux ont écrit"
          />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          §53 : le volume d&apos;inscrits n&apos;est pas l&apos;objectif. Ce qui compte, ce sont les relations
          réellement engagées.
        </p>
      </section>

      <section>
        <SectionLabel>Utilisateurs actifs</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="DAU" value={active.dau} hint="Actifs sur 24 h" />
          <Stat label="WAU" value={active.wau} hint="Actifs sur 7 jours" />
          <Stat label="MAU" value={active.mau} hint="Actifs sur 30 jours" />
          <Stat label="DAU / MAU" value={active.stickiness} suffix=" %" hint="Régularité d'usage" />
        </div>
      </section>

      <section>
        <SectionLabel>Entonnoir d&apos;activation</SectionLabel>
        <div className="e-card p-4">
          <ul className="space-y-2">
            {funnel.map((step) => (
              <li key={step.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{step.label}</span>
                  <span className="font-semibold">
                    {step.measured ? step.count.toLocaleString("fr-FR") : "non mesuré"}
                    {step.measured && signups > 0 && step.key !== "signup" && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "var(--fg-muted)" }}>
                        {Math.round((step.count / signups) * 100)} % des inscrits
                      </span>
                    )}
                  </span>
                </div>
                {step.measured ? (
                  <div className="e-meter mt-1">
                    <span style={{ width: `${signups > 0 ? Math.max(2, (step.count / signups) * 100) : 2}%` }} />
                  </div>
                ) : (
                  <div
                    className="mt-1 rounded-full"
                    style={{ height: "0.5rem", background: "var(--color-sand-300)", opacity: 0.4 }}
                  />
                )}
                {step.note && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {step.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionLabel>Taux clés</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Profils publiés" value={rates.publicationRate} suffix=" %" hint="Parmi les inscrits" />
          <Stat label="Complétude moyenne" value={rates.averageCompleteness} suffix=" %" />
          <Stat label="Taux de matching" value={rates.matchingRate} suffix=" %" hint="Publiés ayant ≥ 1 match" />
          <Stat
            label="Conversation après match"
            value={rates.conversationAfterMatchRate}
            suffix=" %"
            hint="≥ 1 message envoyé"
          />
        </div>
      </section>

      <section>
        <SectionLabel>À traiter</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Signalements ouverts" value={load.openReports} alert={load.openReports > 0} />
          <Stat
            label="Vérifications en attente"
            value={load.pendingVerifications}
            alert={load.pendingVerifications > 5}
          />
          <Stat label="Photos à examiner" value={load.photosPending} alert={load.photosPending > 0} />
          <Stat
            label="Photos douteuses"
            value={load.photosReviewRequired}
            alert={load.photosReviewRequired > 0}
            hint="Contrôle automatique incertain"
          />
        </div>
      </section>

      {donations && (
        <section>
          <SectionLabel>Soutien</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Dons confirmés" value={donations.completed} />
            <Stat label="Donateurs distincts" value={donations.distinctDonors} />
            <Stat label="30 derniers jours" value={donations.amount30} format={formatXof} />
            <Stat label="Depuis le début" value={donations.amountTotal} format={formatXof} />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
            Un don n&apos;ouvre aucun droit. Ces chiffres sont financiers, pas comportementaux : ils ne
            doivent jamais servir à segmenter les membres.
          </p>
        </section>
      )}

      <section>
        <SectionLabel>Densité par pays</SectionLabel>
        <div className="e-card p-4">
          {byCountry.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Aucun profil publié pour l&apos;instant.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {byCountry
                .slice()
                .sort((a, b) => b._count - a._count)
                .map((row) => (
                  <li key={row.countryCode ?? "?"} className="flex justify-between">
                    <span>{row.countryCode ?? "Non renseigné"}</span>
                    <span className="font-semibold">{row._count}</span>
                  </li>
                ))}
            </ul>
          )}
          <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
            §4 : n&apos;ouvrir un nouveau pays qu&apos;une fois la densité atteinte sur le précédent.
          </p>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-wider mb-2"
      style={{ color: accent ? "var(--color-clay-500)" : "var(--fg-muted)" }}
    >
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  hint,
  primary,
  alert,
  suffix,
  format,
}: {
  label: string;
  value: number | null;
  hint?: string;
  primary?: boolean;
  alert?: boolean;
  suffix?: string;
  format?: (value: number) => string;
}) {
  // Une donnée absente s'affiche comme absente. « 0 » serait un mensonge.
  const rendered =
    value === null ? "—" : format ? format(value) : `${value.toLocaleString("fr-FR")}${suffix ?? ""}`;

  return (
    <div className="e-card p-4" style={alert ? { borderColor: "var(--color-danger-500)" } : undefined}>
      <p className={primary ? "e-display text-3xl" : "e-display text-2xl"}>{rendered}</p>
      <p className="text-sm mt-0.5">{label}</p>
      {hint && (
        <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
