import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contacter l'équipe EDENIA : support, sécurité, confidentialité, partenariats et églises.",
  alternates: { canonical: "/contact" },
};

const CHANNELS = [
  { label: "Support et questions générales", email: "support@edenia.app", note: "Réponse sous 48 h ouvrées." },
  { label: "Signaler un danger immédiat", email: "securite@edenia.app", note: "Traité en priorité. Signalez aussi le profil depuis l'application." },
  { label: "Données personnelles et droits", email: "confidentialite@edenia.app", note: "Réponse sous 30 jours." },
  { label: "Églises et partenariats", email: "eglises@edenia.app", note: "Pour rejoindre le réseau EDENIA Church Partners." },
  { label: "Presse", email: "presse@edenia.app", note: "" },
];

export default function Page() {
  return (
    <ContentPage kicker="Nous joindre" title="Contact" lead="Écrivez-nous — une vraie personne lit chaque message.">
      <div className="not-prose space-y-3 my-8">
        {CHANNELS.map((channel) => (
          <div key={channel.email} className="e-card p-4">
            <p className="font-semibold text-sm">{channel.label}</p>
            <a href={`mailto:${channel.email}`} className="text-sm underline" style={{ color: "var(--color-clay-500)" }}>
              {channel.email}
            </a>
            {channel.note && (
              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{channel.note}</p>
            )}
          </div>
        ))}
      </div>
      <h2>En cas d'urgence</h2>
      <p>
        EDENIA n'est pas un service d'urgence. Si vous êtes en danger immédiat, contactez les services de
        secours de votre pays. Nous pouvons agir sur un compte, pas sur une situation physique.
      </p>
    </ContentPage>
  );
}
