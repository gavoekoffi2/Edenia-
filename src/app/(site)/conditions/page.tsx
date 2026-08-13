import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Les règles d'usage d'EDENIA : qui peut s'inscrire, ce qui est interdit, et comment les sanctions sont appliquées.",
  alternates: { canonical: "/conditions" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Légal"
      title="Conditions d'utilisation"
      lead="Des règles courtes et lisibles valent mieux qu'un contrat que personne ne lit."
      blocks={[
        {
          heading: "Qui peut s'inscrire",
          bullets: [
            "Vous devez avoir 18 ans révolus. Aucune exception.",
            "Un seul compte par personne.",
            "Vous devez être libre de vous engager. Se présenter comme célibataire en étant marié est un motif de bannissement.",
            "Vous vous inscrivez en votre nom, avec vos propres photos.",
          ],
        },
        {
          heading: "Ce qui est interdit",
          bullets: [
            "Demander de l'argent à un autre membre, sous quelque prétexte que ce soit.",
            "Utiliser les photos ou l'identité d'une autre personne.",
            "Harceler, menacer, insulter ou faire pression sur un membre.",
            "Publier du contenu sexuellement explicite ou violent.",
            "Faire de la publicité, recruter, ou utiliser EDENIA à des fins commerciales.",
            "Contourner une suspension en créant un nouveau compte.",
          ],
        },
        {
          heading: "Sanctions",
          paragraphs: [
            "Les mesures sont progressives : avertissement, restriction, suspension, bannissement. Elles sont motivées et vous sont communiquées.",
            "Deux situations entraînent une mesure immédiate, sans progressivité : le soupçon de minorité et une demande d'argent caractérisée.",
          ],
        },
        {
          heading: "Ce qu'EDENIA ne garantit pas",
          paragraphs: [
            "Nous ne garantissons pas que vous rencontrerez quelqu'un, ni que les personnes que vous rencontrerez sont honnêtes ou sincères. Nos vérifications portent sur des éléments factuels et limités, décrits sur la page « Profils vérifiés ».",
            "Le score de compatibilité est indicatif. Ce n'est ni une prédiction, ni un conseil, ni un engagement.",
            "EDENIA ne remplace ni un accompagnement pastoral, ni un conseil juridique, ni un suivi psychologique.",
          ],
        },
        {
          heading: "Votre contenu",
          paragraphs: [
            "Vos textes et vos photos restent les vôtres. Vous nous accordez uniquement le droit de les afficher dans le cadre du service, et vous pouvez les retirer à tout moment.",
          ],
        },
        {
          heading: "Résiliation",
          paragraphs: [
            "Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Un abonnement en cours reste actif jusqu'à son terme et n'est pas reconduit automatiquement sans votre accord.",
          ],
        },
      ]}
    />
  );
}
