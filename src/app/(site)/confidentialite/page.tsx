import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données EDENIA collecte, pourquoi, pendant combien de temps, et vos droits.",
  alternates: { canonical: "/confidentialite" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Légal"
      title="Politique de confidentialité"
      lead="EDENIA traite des convictions religieuses et des projets de vie. Ce sont des données sensibles, et nous les traitons comme telles."
      blocks={[
        {
          heading: "Le principe de départ",
          paragraphs: [
            "Nous ne collectons que ce dont la plateforme a besoin pour fonctionner. Nous ne vendons aucune donnée personnelle, à personne, dans aucune circonstance.",
            "Ce document décrit ce que nous faisons réellement. Il sera mis à jour si nos pratiques changent, et vous en serez informé.",
          ],
        },
        {
          heading: "Données collectées",
          bullets: [
            "Compte : numéro de téléphone ou adresse e-mail (un seul est requis), pays, date de création.",
            "Profil : prénom, date de naissance, genre, ville, profession, études, langues, situation familiale, photos.",
            "Convictions religieuses : dénomination, église, engagement, fréquence de participation, importance de la prière. Ces données relèvent d'une catégorie particulière et font l'objet d'un consentement distinct.",
            "Projet de vie : vision du mariage, enfants, finances, relation aux familles, lieu de vie envisagé.",
            "Usage : likes, matchs, messages, activité récente, appareil utilisé.",
            "Vérification : document d'identité et selfie, uniquement si vous demandez la vérification d'identité.",
          ],
        },
        {
          heading: "Bases légales",
          paragraphs: [
            "L'exécution du service fonde le traitement de votre compte et de votre profil. Le consentement explicite, distinct et révocable fonde le traitement de vos convictions religieuses et de la vérification par une église.",
            "Notre intérêt légitime à protéger la communauté fonde la détection des fraudes et la modération. Une obligation légale peut fonder la conservation de certains journaux.",
          ],
        },
        {
          heading: "Durées de conservation",
          bullets: [
            "Documents de vérification d'identité : détruits au plus tard 7 jours après la décision.",
            "Compte supprimé à votre demande : données personnelles effacées sous 30 jours.",
            "Compte inactif depuis 24 mois : vous êtes prévenu, puis le compte est anonymisé.",
            "Journaux d'audit : conservés sous forme pseudonymisée, sans identifiant en clair.",
          ],
        },
        {
          heading: "Ce que les autres voient",
          paragraphs: [
            "Votre profil public ne contient jamais votre numéro, votre e-mail, votre date de naissance exacte, votre position précise, ni aucun score interne.",
            "Votre activité est arrondie (« actif cette semaine »), jamais horodatée à la minute. Vous pouvez rendre privées les sections « Ma foi » et « Mon projet de mariage » tout en restant matchable dessus : le calcul se fait côté serveur, sans exposer vos réponses.",
          ],
        },
        {
          heading: "Vos droits",
          bullets: [
            "Accéder à vos données et en obtenir une copie.",
            "Corriger toute information inexacte, directement depuis votre profil.",
            "Supprimer votre compte et vos données.",
            "Retirer un consentement à tout moment — notamment celui portant sur vos convictions religieuses ou la vérification par une église.",
            "Vous opposer à un traitement et limiter l'usage de vos données.",
          ],
          callout:
            "Pour exercer un droit : confidentialite@edenia.app. Nous répondons sous 30 jours.",
        },
        {
          heading: "Sécurité",
          paragraphs: [
            "Les données les plus sensibles — pièces d'identité, selfies de vérification, contact de confiance — sont chiffrées au repos. Les accès internes sont limités par rôle : un agent de vérification ne voit pas les conversations, un modérateur ne voit pas les documents d'identité.",
            "Chaque accès administratif est journalisé.",
          ],
        },
      ]}
    />
  );
}
