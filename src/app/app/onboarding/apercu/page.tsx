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

  /*
   * §14 — pré-sélection de la ville comprise par l'IA.
   *
   * `Profile.cityLabel` est le seul champ du contrat d'extraction que la
   * persistance ne pouvait pas écrire : la base veut un `cityId`, l'IA n'a
   * qu'un nom. Le sélecteur arrivait donc vide, et l'écran redemandait une
   * ville que la personne venait de dire — après la lui avoir affichée dans
   * « ce que j'ai compris ». Sur un téléphone d'entrée de gamme en 3G, faire
   * ressaisir ce qu'on vient d'entendre est exactement la friction que ce
   * parcours doit éviter.
   *
   * C'est une pré-sélection, pas une décision : le champ reste modifiable, et
   * un nom qui ne correspond à rien laisse simplement le sélecteur vide.
   */
  const understoodCity = preview.rows.find((row) => row.key === "Profile.cityLabel")?.value ?? "";
  const defaultCityId = matchCity(understoodCity, cities);

  return (
    <ProfileReview
      rows={preview.rows}
      generated={preview.generated}
      cities={cities.map((city) => ({
        id: city.id,
        // Inutile de répéter « — Togo » sur chaque ligne tant qu'un seul pays est ouvert.
        label: singleCountry ? city.nameFr : `${city.nameFr} — ${city.country.nameFr}`,
      }))}
      defaultCityId={defaultCityId}
    />
  );
}

/**
 * Rapprochement tolérant d'un nom de ville dit à l'oral ou tapé vite.
 *
 * On compare sans accents ni casse : « lome » doit trouver « Lomé », parce
 * qu'un clavier de téléphone au Togo ne met pas toujours les accents. Aucune
 * correspondance approximative au-delà de ça — pré-sélectionner la mauvaise
 * ville serait pire que de n'en pré-sélectionner aucune.
 */
function matchCity(label: string, cities: Array<{ id: string; nameFr: string }>): string | null {
  const needle = fold(label);
  if (needle.length < 2) return null;
  return cities.find((city) => fold(city.nameFr) === needle)?.id ?? null;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
