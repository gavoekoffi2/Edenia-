import type { Metadata } from "next";
import Link from "next/link";
import { PROMISE, TAGLINE } from "@/components/brand";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Rencontre chrétienne au Togo et en Afrique francophone",
  description:
    "EDENIA réunit des célibataires chrétiens du Togo, du Bénin, de Côte d'Ivoire et de toute l'Afrique francophone " +
    "autour d'une même recherche : une relation sérieuse, fondée sur la foi, orientée vers le mariage.",
  alternates: { canonical: "/" },
  keywords: [
    "rencontre chrétienne Togo",
    "rencontre chrétienne Lomé",
    "célibataire chrétien Togo",
    "rencontre chrétienne Afrique francophone",
    "mariage chrétien Afrique",
  ],
};

const PILLARS = [
  {
    emoji: "🌍",
    title: "Afrique",
    body: "Pensée pour les réalités africaines : Mobile Money, connexions 3G, téléphones d'entrée de gamme, familles présentes.",
  },
  {
    emoji: "✝️",
    title: "Foi",
    body: "La foi n'est pas une case à cocher. Elle structure la compatibilité : pratique, engagement, place dans le couple.",
  },
  {
    emoji: "💍",
    title: "Mariage",
    body: "La finalité est une relation sérieuse. Vision du mariage, enfants, finances, familles : les vrais sujets, tôt.",
  },
  {
    emoji: "🛡️",
    title: "Confiance",
    body: "Vérification humaine, détection des arnaques, modération. Le badge ne s'achète pas.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Un numéro ou un e-mail",
    body: "Pas les deux. Un seul canal vérifié suffit pour créer votre compte.",
  },
  {
    number: "2",
    title: "Vous parlez, EDENIA AI écoute",
    body: "Pas de formulaire de trente champs. Une conversation — à l'écrit ou à la voix — et votre profil se construit.",
  },
  {
    number: "3",
    title: "Vous relisez, vous corrigez",
    body: "Rien n'est publié sans votre accord. Chaque information reste modifiable.",
  },
  {
    number: "4",
    title: "Vous découvrez des personnes compatibles",
    body: "Avec, à chaque fois, l'explication de ce qui vous rapproche — et de ce qu'il reste à découvrir.",
  },
];

export default async function HomePage() {
  // Chiffres réels, jamais gonflés : afficher de faux compteurs serait la
  // première entorse à la promesse de confiance du §65.
  const [publishedProfiles, launchedCountries, verifiedCount] = await Promise.all([
    prisma.profile.count({ where: { isPublished: true } }),
    prisma.country.count({ where: { isLaunched: true } }),
    prisma.profileVerification.count({ where: { status: "APPROVED" } }),
  ]).catch(() => [0, 0, 0] as const);

  return (
    <>
      {/* --- Accroche ----------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pt-14 pb-12 sm:pt-20">
        <p
          className="e-chip mb-5"
          style={{ background: "var(--color-verd-50)", borderColor: "var(--color-verd-100)", color: "var(--color-verd-600)" }}
        >
          🇹🇬 Lancement à Lomé, puis dans toute l'Afrique francophone
        </p>

        <h1 className="e-display text-4xl sm:text-5xl max-w-3xl">
          Des rencontres chrétiennes qui prennent le mariage au sérieux.
        </h1>

        <p className="mt-5 text-lg max-w-2xl" style={{ color: "var(--fg-muted)" }}>
          {PROMISE}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/inscription" className="e-btn e-btn-primary">
            Créer mon profil
          </Link>
          <Link href="/comment-ca-marche" className="e-btn e-btn-secondary">
            Voir comment ça marche
          </Link>
        </div>

        <p className="mt-4 text-xs" style={{ color: "var(--fg-muted)" }}>
          Gratuit. Un numéro de téléphone <em>ou</em> un e-mail suffit. 18 ans minimum.
        </p>
      </section>

      {/* --- Quatre piliers ----------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="e-card p-5">
              <span className="text-2xl" aria-hidden="true">
                {pillar.emoji}
              </span>
              <h2 className="e-display text-lg mt-2">{pillar.title}</h2>
              <p className="text-sm mt-1.5" style={{ color: "var(--fg-muted)" }}>
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* --- Le problème --------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="e-card p-6 sm:p-8">
          <h2 className="e-display text-2xl">Deux personnes chrétiennes ne sont pas forcément compatibles.</h2>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--fg-muted)" }}>
            L'une veut rester au pays, l'autre rêve de partir. L'une soutient sa famille élargie chaque mois,
            l'autre pense que le foyer passe d'abord. L'une veut se marier dans un an, l'autre n'est pas pressée.
            Ces sujets décident d'un mariage — et n'apparaissent jamais sur une photo.
          </p>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--fg-muted)" }}>
            EDENIA les met sur la table dès le départ, sans les transformer en interrogatoire.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            {[
              ["Vision du mariage", "Horizon de temps, enfants, rôles, finances."],
              ["Famille et traditions", "Belle-famille, soutien aux proches, attachement aux traditions."],
              ["Lieu de vie", "Rester, bouger, s'expatrier, revenir."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl p-4" style={{ background: "var(--bg)" }}>
                <p className="font-semibold">{title}</p>
                <p className="mt-1" style={{ color: "var(--fg-muted)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Parcours ------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="e-display text-2xl mb-6">De la découverte au premier match, en quelques minutes.</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.number} className="e-card p-5 flex gap-4">
              <span
                className="shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center font-bold text-sm"
                style={{ background: "var(--color-clay-100)", color: "var(--color-clay-700)" }}
                aria-hidden="true"
              >
                {step.number}
              </span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Confiance ------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ background: "var(--color-verd-500)", color: "#f2ebe1" }}
        >
          <h2 className="e-display text-2xl">Ce que nous ne ferons jamais.</h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 text-sm">
            {[
              "Vendre le badge de vérification.",
              "Promettre que quelqu'un vous est « envoyé par Dieu ».",
              "Présenter un score de compatibilité comme une vérité.",
              "Vendre vos données personnelles.",
              "Créer de fausses notifications pour vous faire revenir.",
              "Garantir l'honnêteté d'une personne.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/securite" className="e-btn e-btn-secondary mt-6" style={{ color: "#f2ebe1", borderColor: "rgba(242,235,225,.4)" }}>
            Notre approche de la sécurité
          </Link>
        </div>
      </section>

      {/* --- Chiffres réels -------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          {[
            [publishedProfiles.toString(), "profils publiés"],
            [verifiedCount.toString(), "profils vérifiés par notre équipe"],
            [launchedCountries.toString(), launchedCountries > 1 ? "pays ouverts" : "pays ouvert"],
          ].map(([value, label]) => (
            <div key={label} className="e-card p-5">
              <p className="e-display text-3xl">{value}</p>
              <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-center mt-3" style={{ color: "var(--fg-muted)" }}>
          Chiffres réels, mis à jour en direct. Nous n'affichons pas de compteurs gonflés.
        </p>
      </section>

      {/* --- Appel final ------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-4 py-14 text-center">
        <h2 className="e-display text-3xl">{TAGLINE}</h2>
        <p className="mt-3" style={{ color: "var(--fg-muted)" }}>
          EDENIA ne remplace ni Dieu, ni l'église, ni votre famille. Elle vous aide simplement à rencontrer
          les bonnes personnes.
        </p>
        <Link href="/inscription" className="e-btn e-btn-primary mt-6">
          Créer mon profil gratuitement
        </Link>
      </section>
    </>
  );
}
