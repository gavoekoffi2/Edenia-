import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Témoignages",
  description: "Les histoires des membres d'EDENIA, publiées uniquement avec leur accord explicite.",
  alternates: { canonical: "/temoignages" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Bientôt"
      title="Témoignages"
      lead="Les histoires des membres d'EDENIA, publiées uniquement avec leur accord explicite."
      blocks={[{ paragraphs: ["Nous n'inventerons pas de témoignages pour remplir cette page, et nous n'en publierons aucun avant d'en avoir de véritables. Si EDENIA a compté dans votre histoire, écrivez-nous : rien ne sera publié sans votre autorisation écrite."] }]}
      cta={{ label: "Créer mon profil", href: "/inscription" }}
    />
  );
}
