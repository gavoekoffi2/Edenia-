import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description:
    "Créer son profil sur EDENIA prend quelques minutes : un numéro ou un e-mail, une conversation avec EDENIA AI, " +
    "et vous découvrez des célibataires chrétiens compatibles.",
  alternates: { canonical: "/comment-ca-marche" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Le parcours"
      title="Comment ça marche"
      lead="Dix étapes, dont huit tiennent en une conversation. L'objectif : que vous passiez de « je découvre EDENIA » à « je vois des personnes compatibles » sans jamais remplir un formulaire interminable."
      cta={{ label: "Commencer maintenant", href: "/inscription" }}
      blocks={[
        {
          heading: "1. Un seul moyen de contact",
          paragraphs: [
            "Vous vous inscrivez avec un numéro de téléphone ou une adresse e-mail. Pas les deux. Nous vous envoyons un code à six chiffres, vous le saisissez, et votre compte existe.",
            "Beaucoup de personnes en Afrique francophone n'utilisent pas d'adresse e-mail au quotidien. Exiger les deux reviendrait à exclure une partie de nos utilisateurs pour rien.",
          ],
        },
        {
          heading: "2. Vous racontez qui vous êtes",
          paragraphs: [
            "EDENIA AI vous pose une première question ouverte : « Raconte-moi qui tu es et ce que tu recherches ici. » Vous écrivez, ou vous appuyez sur le micro et vous parlez.",
            "L'assistant extrait ce que vous avez dit — prénom, âge, ville, profession, objectif — et rebondit sur vos réponses. Si vous parlez de votre engagement dans votre église, il vous demandera la place que vous voulez donner à la prière dans votre couple. Il ne déroule pas une liste.",
          ],
          callout:
            "Si vous répondez « je ne sais pas encore », c'est enregistré comme « à discuter ». EDENIA AI n'invente jamais une réponse à votre place.",
        },
        {
          heading: "3. Vous relisez et vous corrigez",
          paragraphs: [
            "À la fin de la conversation, votre profil vous est présenté en entier : présentation, foi, valeurs, vision du mariage, projet familial, préférences. Chaque ligne est modifiable.",
            "Rien n'est publié tant que vous n'avez pas validé.",
          ],
        },
        {
          heading: "4. Vous ajoutez une photo",
          paragraphs: [
            "Une seule suffit pour commencer. Les photos passent par une modération avant d'apparaître.",
          ],
        },
        {
          heading: "5. Vous découvrez des personnes compatibles",
          paragraphs: [
            "Six façons de découvrir : Pour toi, Près de toi, Profils vérifiés, Compatibilité élevée, Nouveaux profils, et Diaspora.",
            "Chaque profil est accompagné d'un score de compatibilité et, surtout, de son explication : ce qui vous rapproche, et ce qu'il vous reste à découvrir ensemble.",
          ],
        },
        {
          heading: "6. Vous likez, vous matchez, vous discutez",
          paragraphs: [
            "La conversation s'ouvre uniquement lorsque l'intérêt est réciproque. Personne ne peut vous écrire sans que vous l'ayez choisi — y compris en payant.",
            "Après un match, EDENIA peut vous proposer des questions de fond pour aller au-delà du « ça va ? ».",
          ],
        },
        {
          heading: "Et ensuite ?",
          paragraphs: [
            "EDENIA vous accompagne du premier échange à la rencontre réelle : conseils de sécurité, préparation d'un premier rendez-vous, et à terme des événements et des ateliers de préparation au mariage.",
            "La plateforme ne remplace ni Dieu, ni l'église, ni votre famille, ni un accompagnement de couple. Elle facilite la rencontre — le reste vous appartient.",
          ],
        },
      ]}
    />
  );
}
