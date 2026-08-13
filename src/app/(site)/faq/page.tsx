import type { Metadata } from "next";
import { ContentPage, FaqList } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description:
    "Inscription, vérification, tarifs, sécurité, confidentialité : les réponses aux questions les plus " +
    "fréquentes sur EDENIA.",
  alternates: { canonical: "/faq" },
};

const ITEMS = [
  {
    q: "Faut-il un numéro de téléphone et une adresse e-mail ?",
    a: "Non. Un seul des deux suffit pour créer votre compte et utiliser EDENIA. Vous pourrez ajouter l'autre plus tard si vous le souhaitez, mais rien ne vous y oblige.",
  },
  {
    q: "EDENIA est-il gratuit ?",
    a: "Oui pour l'essentiel : créer un profil, découvrir des personnes, liker, matcher, discuter après un match, et demander votre vérification. Premium ajoute des filtres avancés et la compatibilité détaillée, à partir de 1 250 FCFA par mois.",
  },
  {
    q: "Le badge de vérification est-il payant ?",
    a: "Non, et il ne le sera jamais. La vérification est gratuite et indépendante de tout abonnement. Payer ne donne aucun badge et n'accélère aucun dossier.",
  },
  {
    q: "Comment fonctionne le score de compatibilité ?",
    a: "Il compare sept dimensions : foi, vision du mariage, valeurs, projet familial, personnalité, mode de vie et localisation. Il est toujours accompagné de son explication, et reste indicatif : ce n'est pas une prédiction de réussite.",
  },
  {
    q: "Que se passe-t-il si je réponds « je ne sais pas » à une question ?",
    a: "C'est enregistré comme « à discuter ». EDENIA AI n'invente jamais de réponse à votre place, et une non-réponse n'est jamais comptée comme un désaccord dans le calcul de compatibilité.",
  },
  {
    q: "Mon église va-t-elle voir mon profil ?",
    a: "Non. Si vous demandez une vérification d'église, un responsable autorisé répond uniquement à une question fermée : vous connaît-il comme membre ? Il ne voit ni votre profil, ni vos matchs, ni vos conversations. Vous pouvez retirer votre accord à tout moment.",
  },
  {
    q: "Qui peut m'écrire ?",
    a: "Uniquement les personnes avec qui vous avez matché, c'est-à-dire celles que vous avez likées et qui vous ont liké en retour. Personne ne peut vous écrire sans votre accord, y compris en payant.",
  },
  {
    q: "Comment signaler un comportement suspect ?",
    a: "Depuis le profil ou la conversation, via le bouton « Signaler ». C'est gratuit, immédiat, et examiné par une personne. Si on vous demande de l'argent, signalez-le : c'est le signalement le plus utile.",
  },
  {
    q: "Ma position exacte est-elle visible ?",
    a: "Non. EDENIA n'affiche jamais d'adresse ni de position précise. La granularité maximale est la ville.",
  },
  {
    q: "Puis-je supprimer mon compte et mes données ?",
    a: "Oui, à tout moment, depuis vos paramètres. Vos données personnelles sont effacées sous 30 jours. Nous ne vendons jamais de données personnelles.",
  },
  {
    q: "Quel âge faut-il avoir ?",
    a: "18 ans révolus, sans exception, sur tous les marchés où EDENIA est disponible.",
  },
  {
    q: "EDENIA fonctionne-t-il sans bonne connexion ?",
    a: "La plateforme est conçue pour la 3G et les téléphones d'entrée de gamme : pages légères, images compressées, chargement progressif. Vous pouvez aussi l'installer sur votre écran d'accueil comme une application.",
  },
  {
    q: "Dans quels pays EDENIA est-il disponible ?",
    a: "Le lancement se fait au Togo, à Lomé d'abord. Le Bénin, la Côte d'Ivoire, le Cameroun, le Sénégal et les autres pays francophones suivront, un par un, pour garantir une vraie densité de profils.",
  },
];

export default function Page() {
  return (
    <ContentPage kicker="Aide" title="Questions fréquentes">
      <FaqList items={ITEMS} />
    </ContentPage>
  );
}
