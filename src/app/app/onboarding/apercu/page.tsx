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

  // §4 : on ne propose que les villes des pays effectivement ouverts, plus les
  // pays de diaspora — inutile de laisser choisir une ville sans communauté.
  const cities = await prisma.city.findMany({
    where: { country: { OR: [{ isLaunched: true }, { isAfrican: false }] } },
    include: { country: true },
    orderBy: [{ countryCode: "asc" }, { nameFr: "asc" }],
  });

  return (
    <ProfileReview
      rows={preview.rows}
      generated={preview.generated}
      cities={cities.map((city) => ({ id: city.id, label: `${city.nameFr} — ${city.country.nameFr}` }))}
      defaultCityId={null}
    />
  );
}
