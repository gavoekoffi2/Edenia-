import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { LAUNCHED_COUNTRIES, PILOT_COUNTRY } from "@/lib/geo/data";
import { AdminCountryRow } from "@/components/admin-country-row";

export const metadata = { title: "Pays", robots: { index: false } };
export const dynamic = "force-dynamic";

export const COUNTRY_STATUSES = ["ACTIVE", "TEST", "COMING_SOON", "PAUSED"] as const;

export const COUNTRY_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ouvert",
  TEST: "Test interne",
  COMING_SOON: "Bientôt",
  PAUSED: "Suspendu",
};

/**
 * §4, §20 — pilotage du déploiement pays par pays.
 *
 * Le statut visible ici est éditable ; la liste des pays réellement servis au
 * démarrage vient de `LAUNCHED_COUNTRIES` (variable d'environnement). Les deux
 * sont affichés côte à côte pour rendre visible un désaccord éventuel plutôt
 * que de le laisser produire un bug incompréhensible.
 */
export default async function Page() {
  await requireAdminPage("countries.manage");

  const [countries, profileCounts] = await Promise.all([
    prisma.country.findMany({ orderBy: [{ launchOrder: "asc" }, { nameFr: "asc" }] }),
    prisma.profile.groupBy({ by: ["countryCode"], _count: true }),
  ]);

  const counts = new Map(profileCounts.map((row) => [row.countryCode ?? "", row._count]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Pays</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          §4 : n&apos;ouvrir un pays qu&apos;une fois la densité atteinte sur le précédent. Marché pilote :{" "}
          {PILOT_COUNTRY}.
        </p>
      </div>

      <div className="e-card p-3 text-sm">
        <p>
          <strong>Servis au démarrage</strong> (variable <code>LAUNCHED_COUNTRIES</code>) :{" "}
          {LAUNCHED_COUNTRIES.join(", ")}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Le statut ci-dessous pilote l&apos;affichage éditorial. Ouvrir réellement un pays à l&apos;inscription
          demande de l&apos;ajouter à cette variable puis de redéployer — un pays ouvert par inadvertance
          depuis une interface web serait difficile à refermer.
        </p>
      </div>

      <ul className="space-y-2">
        {countries.map((country) => (
          <AdminCountryRow
            key={country.code}
            code={country.code}
            nameFr={country.nameFr}
            dialCode={country.dialCode}
            status={country.status}
            isLaunched={country.isLaunched}
            servedAtBoot={LAUNCHED_COUNTRIES.includes(country.code)}
            profiles={counts.get(country.code) ?? 0}
          />
        ))}
      </ul>
    </div>
  );
}
