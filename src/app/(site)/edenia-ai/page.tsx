import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "EDENIA AI",
  description:
    "EDENIA AI construit votre profil à partir d'une conversation, à l'écrit ou à la voix. " +
    "Elle n'invente jamais une information, et ne prétend jamais parler au nom de Dieu.",
  alternates: { canonical: "/edenia-ai" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Fonctionnalité signature"
      title="EDENIA AI"
      lead="« Parle-moi de toi. » Une phrase, et votre profil commence à exister. Pas de formulaire de trente champs — une conversation."
      cta={{ label: "Essayer", href: "/inscription" }}
      blocks={[
        {
          heading: "Vous parlez, elle structure",
          paragraphs: [
            "Vous écrivez, ou vous appuyez sur le micro. Une phrase comme « Je m'appelle Claude, j'ai 31 ans, je suis entrepreneur dans le numérique, j'habite à Lomé et je cherche une relation pouvant aboutir au mariage » suffit à remplir cinq champs d'un coup.",
            "L'assistant vous montre ce qu'il a compris, et vous corrigez d'un geste si besoin.",
          ],
        },
        {
          heading: "Elle s'adapte à vos réponses",
          paragraphs: [
            "EDENIA AI ne déroule pas une liste de questions. Si vous dites que la prière est importante pour vous et que vous êtes engagé dans votre église, elle vous demandera ensuite quelle place vous voulez donner à la prière dans votre couple.",
            "C'est une conversation, pas un questionnaire déguisé.",
          ],
        },
        {
          heading: "Elle n'invente jamais",
          paragraphs: [
            "C'est la règle la plus stricte du produit, et elle est vérifiée par le code, pas seulement par une consigne : toute information enregistrée doit être adossée à une phrase que vous avez réellement prononcée. Sans citation vérifiable, la donnée est rejetée.",
            "Si vous dites « je ne sais pas encore si je veux des enfants », votre profil affichera « à discuter ». Jamais « oui », jamais « non ».",
          ],
          callout:
            "Pour les informations importantes — prénom, âge, dénomination, désir de mariage — l'assistant vous demande systématiquement de confirmer avant d'enregistrer.",
        },
        {
          heading: "Elle ne parle pas au nom de Dieu",
          paragraphs: [
            "EDENIA AI ne dira jamais qu'une personne vous est « envoyée par Dieu », ne parlera jamais d'« âme sœur », ne prédira aucune destinée amoureuse et ne garantira l'honnêteté de personne.",
            "Un filtre bloque ces formulations avant qu'elles n'atteignent votre écran. Le discernement vous appartient — avec les personnes en qui vous avez confiance.",
          ],
        },
        {
          heading: "Le mode vocal, et son alternative",
          paragraphs: [
            "Parler est souvent plus rapide qu'écrire, surtout sur un petit clavier. Vous pouvez enregistrer, réécouter, recommencer, corriger la transcription, puis envoyer.",
            "La saisie au clavier reste disponible en permanence. Le vocal est un raccourci, jamais un passage obligé.",
          ],
        },
        {
          heading: "Ce qu'elle fait ensuite",
          paragraphs: [
            "Au-delà de l'inscription, EDENIA AI peut améliorer votre présentation, expliquer une compatibilité, proposer une première question après un match, et aider à repérer un comportement suspect.",
            "Elle ne prend jamais de décision relationnelle à votre place.",
          ],
        },
      ]}
    />
  );
}
