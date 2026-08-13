import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Pourquoi EDENIA",
  description:
    "Pourquoi une plateforme de rencontres chrétiennes conçue spécifiquement pour l'Afrique francophone, " +
    "et non une application internationale traduite en français.",
  alternates: { canonical: "/pourquoi-edenia" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Notre raison d'être"
      title="Pourquoi EDENIA"
      lead="Il existe des plateformes chrétiennes internationales. Il existe des applications de rencontre généralistes disponibles en Afrique. Aucune des deux n'a été pensée pour un célibataire chrétien de Lomé, de Cotonou ou de Douala."
      cta={{ label: "Créer mon profil", href: "/inscription" }}
      blocks={[
        {
          heading: "Une application traduite n'est pas une application adaptée",
          paragraphs: [
            "Traduire une interface en français ne règle rien. Une application conçue ailleurs suppose une carte bancaire, une connexion stable, un téléphone récent, une adresse e-mail quotidienne, et une conception du couple où les familles n'ont pas voix au chapitre.",
            "Aucune de ces hypothèses ne tient à Lomé. EDENIA part de l'inverse : Mobile Money, 3G instable, téléphone d'entrée de gamme, numéro de téléphone comme identité principale, et des familles bien présentes dans le projet de mariage.",
          ],
        },
        {
          heading: "Être chrétien ne suffit pas à être compatible",
          paragraphs: [
            "Deux personnes peuvent partager la même foi et être profondément incompatibles : sur l'horizon du mariage, sur les enfants, sur la gestion de l'argent, sur le soutien à la famille élargie, sur le fait de rester au pays ou de partir.",
            "Ces sujets décident d'un mariage. Ils n'apparaissent sur aucune photo, et aucun filtre d'âge ou de distance ne les capte. EDENIA les place au centre de la compatibilité.",
          ],
        },
        {
          heading: "Les formulaires font fuir",
          paragraphs: [
            "Demander quarante champs avant de laisser quelqu'un utiliser un produit, c'est perdre la majorité des inscrits en route. EDENIA AI remplace le formulaire par une conversation, à l'écrit ou à la voix.",
            "Vous parlez normalement ; l'assistant structure. Vous relisez et vous corrigez ; il ne publie rien sans vous.",
          ],
        },
        {
          heading: "La confiance ne se décrète pas",
          paragraphs: [
            "Un espace de rencontre sans vérification se remplit de faux profils, puis se vide de ses membres sincères. C'est pourquoi la vérification chez EDENIA passe par des personnes, pas seulement par des algorithmes — et pourquoi elle est gratuite.",
            "Le jour où le badge se vendrait, il ne vaudrait plus rien.",
          ],
        },
        {
          heading: "Une densité locale avant l'expansion",
          paragraphs: [
            "Nous ouvrons pays par pays, en commençant par le Togo et Lomé. Une plateforme présente dans quinze pays avec trois profils par ville n'aide personne.",
            "Mieux vaut une vraie communauté à Lomé qu'une présence symbolique sur tout le continent.",
          ],
        },
      ]}
    />
  );
}
