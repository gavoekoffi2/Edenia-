import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { MONEY_WARNING } from "@/lib/trust/signals";

export const metadata: Metadata = {
  title: "Sécurité et lutte contre les arnaques",
  description:
    "Comment EDENIA lutte contre les faux profils et les arnaques sentimentales : vérification humaine, " +
    "détection des demandes d'argent, modération, et ce que nous ne promettons jamais.",
  alternates: { canonical: "/securite" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Confiance"
      title="Sécurité"
      lead="La confiance est l'un des quatre piliers d'EDENIA. Voici concrètement ce que nous faisons — et ce que nous refusons de promettre."
      blocks={[
        {
          heading: "Ce que nous vérifions",
          paragraphs: [
            "Chaque compte doit avoir un canal de contact vérifié — téléphone ou e-mail — avant de pouvoir liker qui que ce soit. C'est le premier filtre, et le plus efficace contre les comptes jetables.",
            "Au-delà, la vérification est volontaire et gratuite. Vous pouvez demander à ce que votre identité, votre profil ou votre appartenance à une église soient contrôlés par notre équipe.",
          ],
          bullets: [
            "📱 Téléphone vérifié — le numéro appartient bien à ce compte.",
            "✉️ E-mail vérifié — l'adresse a été confirmée par son titulaire.",
            "🪪 Identité vérifiée — un document et un selfie ont été contrôlés par notre équipe, et correspondent.",
            "🛡️ Profil vérifié — plusieurs informations déclarées ont été contrôlées une à une.",
            "⛪ Église vérifiée — une église partenaire a confirmé, avec votre accord, qu'elle vous connaît.",
          ],
        },
        {
          heading: "Ce que le badge ne veut pas dire",
          paragraphs: [
            "Un badge dit ce qui a été contrôlé. Il ne dit rien des intentions d'une personne. Nous n'affirmerons jamais qu'un membre d'EDENIA est honnête, sincère ou fiable — nous n'en savons rien, et prétendre le contraire serait vous mettre en danger.",
            "La vérification ne s'achète pas. Un abonnement Premium ne donne aucun badge, et n'accélère aucun dossier.",
          ],
        },
        {
          heading: "Les arnaques sentimentales",
          paragraphs: [
            "C'est la menace la plus fréquente, et la plus coûteuse. Le scénario est presque toujours le même : une attention très intense en quelques jours, une histoire touchante, un refus d'appel vidéo, une insistance pour quitter la plateforme, puis une urgence financière.",
            "EDENIA analyse les messages pour détecter les demandes d'argent et les schémas connus. Quand un signal apparaît, vous recevez immédiatement un avertissement, et le message est examiné par notre équipe.",
          ],
          callout: MONEY_WARNING,
        },
        {
          heading: "La règle qui protège vraiment",
          paragraphs: [
            "Aucun système de détection ne remplace un réflexe simple : ne transférez jamais d'argent à une personne rencontrée en ligne, quelle que soit la raison invoquée, quel que soit le temps que vous avez passé à discuter.",
            "Ni T-Money, ni Flooz, ni Orange Money, ni Wave, ni Western Union, ni carte de recharge. Aucune exception, même en cas d'urgence médicale présentée comme réelle.",
          ],
        },
        {
          heading: "Signaler, bloquer",
          paragraphs: [
            "Ces deux actions sont gratuites, immédiates, et resteront toujours gratuites. Bloquer fait disparaître la personne de votre expérience. Signaler déclenche un examen humain.",
            "Un signalement protège aussi les personnes qui seraient contactées après vous : c'est le geste le plus utile que vous puissiez faire pour la communauté.",
          ],
        },
        {
          heading: "Modération et sanctions",
          paragraphs: [
            "Les mesures sont progressives : avertissement, puis restriction, puis suspension, puis bannissement.",
            "Deux situations échappent à cette progressivité et entraînent une mesure immédiate : le soupçon de minorité, et une demande d'argent caractérisée. Attendre un second incident reviendrait à laisser un préjudice se produire.",
          ],
        },
        {
          heading: "Se rencontrer en vrai",
          paragraphs: [
            "Le passage au réel est l'objectif. Il demande quelques précautions élémentaires : choisissez un lieu public, prévenez une personne de confiance de l'heure et du lieu, gardez votre moyen de transport, et n'envoyez jamais d'argent avant ou après.",
            "Si quelque chose vous met mal à l'aise, vous n'avez aucune justification à donner. Partez.",
          ],
        },
      ]}
      cta={{ label: "Créer mon profil", href: "/inscription" }}
    />
  );
}
