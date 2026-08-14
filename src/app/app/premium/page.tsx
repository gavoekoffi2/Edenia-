import Link from "next/link";
import { notFound } from "next/navigation";
import { premiumIsPublic } from "@/lib/config/monetization";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { PLAN_OFFERS, formatXof } from "@/lib/premium/entitlements";
import { premiumStatus, GATEWAY, ENVIRONMENT } from "@/lib/payments/service";
import { STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";
import { CheckoutButton } from "@/components/checkout-button";

export const metadata = { title: "EDENIA Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

/** §18 — page Premium : ce qui est inclus, le prix, la durée, puis le paiement. */
const FEATURES = [
  { icon: "🛡️", title: "Filtre « profils vérifiés »", body: "N'afficher que les profils contrôlés par notre équipe." },
  { icon: "🔎", title: "Filtres avancés", body: "Dénomination, vision du mariage, projet familial, engagement." },
  { icon: "✨", title: "Compatibilité détaillée", body: "Le détail des 7 dimensions, pas seulement le score global." },
  { icon: "❤️", title: "Voir qui vous a liké", body: "Sans attendre la réciprocité pour le découvrir." },
  { icon: "🌍", title: "Mode diaspora complet", body: "Accès élargi aux profils hors d'Afrique." },
  { icon: "🤖", title: "Aide IA", body: "Améliorer votre présentation et vos réponses." },
  { icon: "📈", title: "Plus de likes", body: "100 par jour au lieu de 20." },
];

/**
 * §1 du sprint final — en lancement gratuit, cette page n'existe pas pour les
 * membres. Le code reste en place, non pas commente mais eteint : rallumer
 * Premium tient a une variable d'environnement, sans redeploiement de schema
 * ni reecriture d'ecran.
 */
export default async function Page() {
  if (!premiumIsPublic) notFound();
  const user = await requireUser();
  const [premium, history] = await Promise.all([
    premiumStatus(user.id),
    prisma.payment.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const simulated = GATEWAY === "SIMULATED";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">✦ EDENIA Premium</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Du confort pour chercher mieux. Jamais la sécurité, jamais le badge.
        </p>
      </div>

      {premium.isPremium && (
        <div className="e-card p-4" style={{ borderColor: "var(--color-gold-400)" }}>
          <p className="font-semibold">Votre abonnement est actif</p>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            Jusqu'au {premium.endsAt?.toLocaleDateString("fr-FR")}. Aucun renouvellement automatique
            sans votre accord.
          </p>
        </div>
      )}

      {simulated && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: "var(--color-gold-100)", border: "1px solid var(--color-gold-400)", color: "#7a5216" }}
          role="note"
        >
          <p className="font-bold">🟡 PAIEMENT — MODE TEST</p>
          <p className="mt-1">
            Aucun agrégateur réel n'est branché : aucun débit n'aura lieu. Le parcours complet
            (checkout, webhook signé, activation) est néanmoins exécuté.
          </p>
        </div>
      )}

      <section className="e-card p-4">
        <h2 className="e-display text-lg">Ce que Premium débloque</h2>
        <ul className="mt-3 space-y-2.5">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3 text-sm">
              <span aria-hidden="true">{feature.icon}</span>
              <span>
                <strong>{feature.title}</strong>
                <span className="block" style={{ color: "var(--fg-muted)" }}>{feature.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* §15 : rappelé au moment précis où l'utilisateur s'apprête à payer. */}
      <div className="e-card p-4">
        <p className="text-sm font-semibold">Ce que Premium n'achète pas</p>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Le badge « Profil vérifié » n'est pas à vendre. Payer ne vous rend pas vérifié et n'accélère
          aucun dossier. La vérification reste gratuite, indépendante, et contrôlée par EDENIA.
          Signaler et bloquer resteront toujours gratuits.
        </p>
        <Link href="/profils-verifies" className="text-sm underline mt-2 inline-block">
          Comment fonctionne la vérification
        </Link>
      </div>

      {!premium.isPremium && (
        <section className="space-y-2">
          <h2 className="e-display text-lg">Choisir une formule</h2>
          {PLAN_OFFERS.map((offer) => (
            <div key={offer.code} className="e-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{offer.nameFr}</p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    {offer.perMonthLabel} · {offer.durationDays} jours · sans reconduction automatique
                  </p>
                  {offer.highlight && <span className="e-chip e-chip-gold mt-1.5">{offer.highlight}</span>}
                </div>
                <p className="e-display text-xl shrink-0">{formatXof(offer.priceCents)}</p>
              </div>
              <CheckoutButton planCode={offer.code} simulated={simulated} />
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Le paiement se fait sur la page sécurisée de notre partenaire GeniusPay : Mobile Money
            (Wave, Orange, MTN, Moov…) ou carte bancaire. EDENIA ne voit ni ne conserve vos données
            de carte.
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Historique de mes paiements</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3">
                <span>
                  {payment.plan?.nameFr ?? payment.planCode}
                  <span className="block text-xs" style={{ color: "var(--fg-muted)" }}>
                    {payment.createdAt.toLocaleDateString("fr-FR")} · {payment.orderRef}
                  </span>
                </span>
                <span className="text-right">
                  {formatXof(payment.amountCents)}
                  <span className="block text-xs" style={{ color: "var(--fg-muted)" }}>
                    {STATUS_LABEL[payment.status as PaymentStatus] ?? payment.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
            Environnement : {ENVIRONMENT}. Conservez la référence en cas de réclamation.
          </p>
        </section>
      )}
    </div>
  );
}
