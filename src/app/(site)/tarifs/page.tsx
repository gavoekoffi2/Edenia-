import type { Metadata } from "next";
import Link from "next/link";
import { NEVER_PAYWALLED, PLAN_OFFERS, formatXof } from "@/lib/premium/entitlements";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "EDENIA est gratuit pour l'essentiel : profil, matching, likes, matchs, chat et vérification. " +
    "Premium à partir de 1 250 FCFA par mois débloque les filtres avancés et la compatibilité détaillée.",
  alternates: { canonical: "/tarifs" },
};

const PREMIUM_FEATURES = [
  "Filtre « uniquement les profils vérifiés »",
  "Filtres avancés (dénomination, vision du mariage, projet familial)",
  "Compatibilité détaillée sur les 7 dimensions",
  "Voir qui vous a liké",
  "Mode diaspora complet",
  "Aide IA pour votre présentation et vos réponses",
  "Plus de likes par jour (100 au lieu de 20)",
];

const FREE_LABELS: Record<string, string> = {
  "profile.create": "Créer son profil",
  "profile.edit": "Modifier son profil",
  "discovery.basic": "Découvrir des profils",
  "match.like": "Liker",
  "match.chat": "Discuter après un match",
  "badge.see": "Voir les badges de vérification",
  "verification.request": "Demander sa propre vérification",
  "safety.report": "Signaler un profil",
  "safety.block": "Bloquer quelqu'un",
  "safety.warnings": "Recevoir les avertissements anti-arnaque",
  "compatibility.score": "Voir son score de compatibilité",
  "ai.onboarding": "Créer son profil avec EDENIA AI",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="e-display text-3xl sm:text-4xl">Tarifs</h1>
      <p className="mt-4 text-lg max-w-2xl" style={{ color: "var(--fg-muted)" }}>
        L'essentiel est gratuit et le restera. Nos prix sont calés sur le coût d'un forfait data local,
        pas sur une conversion d'un tarif occidental en FCFA.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mt-10">
        <div className="e-card p-6">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Gratuit
          </p>
          <p className="e-display text-3xl mt-2">0 FCFA</p>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            Pour toujours
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {NEVER_PAYWALLED.map((capability) => (
              <li key={capability} className="flex gap-2">
                <span aria-hidden="true" style={{ color: "var(--color-success-600)" }}>✓</span>
                <span>{FREE_LABELS[capability] ?? capability}</span>
              </li>
            ))}
          </ul>
          <Link href="/inscription" className="e-btn e-btn-secondary mt-6 w-full">
            Commencer gratuitement
          </Link>
        </div>

        <div className="e-card p-6" style={{ borderColor: "var(--color-gold-400)" }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-gold-500)" }}>
            Premium
          </p>
          <p className="e-display text-3xl mt-2">à partir de 1 250 FCFA</p>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            par mois, selon la durée choisie
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span aria-hidden="true" style={{ color: "var(--color-gold-500)" }}>✦</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2">
            {PLAN_OFFERS.map((offer) => (
              <div
                key={offer.code}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--bg)" }}
              >
                <div>
                  <p className="font-semibold">{offer.nameFr.replace("Premium — ", "")}</p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{offer.perMonthLabel}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatXof(offer.priceCents)}</p>
                  {offer.highlight && (
                    <span className="e-chip e-chip-gold mt-1">{offer.highlight}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link href="/inscription" className="e-btn e-btn-primary mt-6 w-full">
            Créer mon compte
          </Link>
        </div>
      </div>

      <section className="e-card p-6 mt-8">
        <h2 className="e-display text-xl">Ce que Premium n'achète pas</h2>
        <p className="mt-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          Le badge de vérification n'est pas à vendre. Payer ne vous rend pas vérifié, n'accélère pas votre
          dossier, et ne donne aucun signal de confiance aux autres membres.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          De même, aucune fonction de sécurité n'est payante : signaler, bloquer, recevoir les avertissements
          anti-arnaque et demander sa vérification resteront gratuits pour tout le monde. Une plateforme qui
          fait payer la protection de ses membres n'a pas compris son métier.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="e-display text-xl">Moyens de paiement</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          Mobile Money selon votre pays — T-Money, Flooz, MTN Mobile Money, Moov Money, Orange Money, Wave —
          et carte bancaire. Aucun abonnement n'est reconduit sans votre accord explicite.
        </p>
      </section>
    </div>
  );
}
