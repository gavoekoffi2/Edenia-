import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { LEVELS, VERIFICATION_LEVELS } from "@/lib/verification/levels";

export const metadata: Metadata = {
  title: "Profils vérifiés",
  description:
    "Les cinq niveaux de vérification EDENIA : téléphone, e-mail, identité, profil et église. " +
    "Ce que chaque badge signifie, et surtout ce qu'il ne signifie pas.",
  alternates: { canonical: "/profils-verifies" },
};

export default function Page() {
  return (
    <ContentPage
      kicker="Confiance"
      title="Profils vérifiés EDENIA"
      lead="Un badge dit ce qui a été contrôlé — jamais ce qu'une personne vaut. Voici les cinq niveaux, avec leurs limites écrites noir sur blanc."
      cta={{ label: "Demander ma vérification", href: "/inscription" }}
    >
      <div className="not-prose space-y-3 my-8">
        {VERIFICATION_LEVELS.map((level) => {
          const descriptor = LEVELS[level];
          return (
            <div key={level} className="e-card p-5">
              <p className="font-semibold flex items-center gap-2">
                <span aria-hidden="true">{descriptor.icon}</span>
                {descriptor.label}
                {descriptor.manual && (
                  <span className="e-chip e-chip-verified">Vérification humaine</span>
                )}
              </p>
              <p className="text-sm mt-2">{descriptor.meaning}</p>
              <p className="text-sm mt-1.5" style={{ color: "var(--fg-muted)" }}>
                <strong>Ce que cela ne dit pas :</strong> {descriptor.limitation}
              </p>
            </div>
          );
        })}
      </div>

      <h2>La vérification ne s'achète pas</h2>
      <p>
        Un abonnement Premium ne donne aucun badge et n'accélère aucun dossier. La vérification reste un
        processus indépendant, gratuit, et ouvert à tous les membres — y compris ceux qui n'ont jamais payé.
      </p>
      <p>
        Ce que Premium débloque, c'est le <em>filtre</em> qui permet de n'afficher que des profils vérifiés.
        Le badge lui-même est visible par tout le monde, sur tous les profils, gratuitement.
      </p>

      <h2>Et l'église dans tout ça ?</h2>
      <p>
        Quand vous demandez une vérification d'église, EDENIA pose une question fermée à un responsable
        autorisé : « Reconnaissez-vous cette personne comme quelqu'un que votre église connaît ? »
        Rien d'autre n'est demandé, et rien d'autre n'est conservé.
      </p>
      <p>
        L'église ne voit pas votre profil, ne connaît pas vos matchs, et n'a aucun regard sur vos choix.
        Vous pouvez retirer votre accord à tout moment : le badge disparaît alors.
      </p>
    </ContentPage>
  );
}
