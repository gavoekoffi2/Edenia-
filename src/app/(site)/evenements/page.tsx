import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "EDENIA Events",
  description: "Soirées célibataires, speed dating chrétien, conférences, ateliers de préparation au mariage — organisés avec des églises partenaires, à Lomé d'abord.",
  alternates: { canonical: "/evenements" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Bientôt"
      title="EDENIA Events"
      lead="Soirées célibataires, speed dating chrétien, conférences, ateliers de préparation au mariage — organisés avec des églises partenaires, à Lomé d'abord."
      blocks={[{ paragraphs: ["Nous préférons lancer les événements quand la communauté locale sera suffisamment dense pour qu'une soirée ait du sens. Le premier rendez-vous EDENIA aura lieu à Lomé."] }]}
      cta={{ label: "Créer mon profil", href: "/inscription" }}
    />
  );
}
