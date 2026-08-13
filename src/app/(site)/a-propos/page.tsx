import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { SIGNATURE } from "@/components/brand";

export const metadata: Metadata = {
  title: "À propos",
  description: "EDENIA, la plateforme de rencontres chrétiennes conçue pour l'Afrique francophone.",
  alternates: { canonical: "/a-propos" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="À propos"
      title="EDENIA"
      lead={SIGNATURE}
      blocks={[
        {
          heading: "Ce que nous construisons",
          paragraphs: [
            "EDENIA est une plateforme de rencontres chrétiennes destinée aux célibataires d'Afrique francophone qui cherchent une relation sérieuse pouvant conduire au mariage.",
            "Nous ne construisons pas une application de rencontre généraliste avec une identité chrétienne posée par-dessus. La foi, la culture, la famille et le projet de mariage sont au centre du produit, pas dans son décor.",
          ],
        },
        {
          heading: "Le chemin que nous accompagnons",
          paragraphs: [
            "Découvrir, rencontrer, échanger, se voir réellement, construire une relation, se préparer au mariage, fonder un foyer.",
            "EDENIA n'intervient que sur les premières étapes. Le reste appartient aux personnes, à leurs proches, à leur communauté et à leur foi.",
          ],
        },
        {
          heading: "Notre ligne",
          bullets: [
            "Nous ne vendons pas la confiance. Le badge de vérification n'est pas un produit.",
            "Nous ne promettons pas l'âme sœur. Aucune plateforme ne le peut honnêtement.",
            "Nous ne vendons pas vos données.",
            "Nous ne fabriquons pas d'engagement artificiel.",
            "Nous préférons une communauté dense dans une ville à une présence vide sur un continent.",
          ],
        },
        {
          heading: "Où nous en sommes",
          paragraphs: [
            "Le lancement se fait au Togo, à Lomé. Les marchés suivants s'ouvriront un par un : Bénin, Côte d'Ivoire, Cameroun, Sénégal, RDC, Burkina Faso, et les autres pays francophones du continent.",
          ],
        },
      ]}
      cta={{ label: "Nous écrire", href: "/contact" }}
    />
  );
}
