import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { buildOnboardingPreview } from "@/lib/ai/persistence";
import { prisma } from "@/lib/db/client";
import { ProfileReview } from "@/components/profile-review";

export const metadata = { title: "Votre profil", robots: { index: false } };

export default async function Page() {
  const user = await requireUser();
  if (user.profilePublished) redirect("/app/profil");

  const preview = await buildOnboardingPreview(user.id);

  // §4 + phase pilote : uniquement les villes des pays effectivement ouverts.
  // Aujourd'hui le Togo seul ; ouvrir un pays (`isLaunched`) suffit à faire
  // apparaître ses villes ici, sans modifier cette requête.
  const cities = await prisma.city.findMany({
    where: { country: { isLaunched: true } },
    include: { country: true },
    orderBy: [{ population: "desc" }, { nameFr: "asc" }],
  });

  const singleCountry = new Set(cities.map((city) => city.countryCode)).size <= 1;

  return (
    <ProfileReview
      rows={preview.rows}
      generated={preview.generated}
      cities={cities.map((city) => ({
        id: city.id,
        // Inutile de répéter « — Togo » sur chaque ligne tant qu'un seul pays est ouvert.
        label: singleCountry ? city.nameFr : `${city.nameFr} — ${city.country.nameFr}`,
      }))}
      defaultCityId={null}
    />
  );
}
