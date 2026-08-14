import { requireUser } from "@/lib/auth/current-user";
import { currentTier } from "@/lib/discovery/likes";
import { prisma } from "@/lib/db/client";
import { PLAN_OFFERS, formatXof } from "@/lib/premium/entitlements";
import { methodsForCountry } from "@/lib/payments/provider";
import { CheckoutForm } from "@/components/checkout-form";
import { serviceStatuses } from "@/lib/config/mode";

export const metadata = { title: "EDENIA Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const [tier, profile] = await Promise.all([
    currentTier(user.id),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { countryCode: true } }),
  ]);

  const methods = methodsForCountry(profile?.countryCode ?? "TG");
  const paymentsSimulated = serviceStatuses().find((s) => s.key === "payments")?.mode === "development";

  if (tier === "PREMIUM") {
    return (
      <div className="e-card p-6 text-center">
        <p className="e-display text-xl">✦ Vous êtes Premium</p>
        <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
          Filtres avancés, compatibilité détaillée et mode diaspora sont actifs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-xl">✦ EDENIA Premium</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Du confort, jamais de la sécurité. Le badge de vérification n'est pas à vendre, et votre dossier
          ne sera pas traité plus vite.
        </p>
      </div>

      {paymentsSimulated && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: "var(--color-gold-100)", border: "1px solid var(--color-gold-400)", color: "#7a5216" }}
          role="note"
        >
          <p className="font-bold">🟡 PAIEMENT — MODE TEST</p>
          <p className="mt-1">
            Aucun agrégateur Mobile Money n'est branché : aucun débit réel n'aura lieu. L'abonnement
            s'active tout de même, pour permettre de tester les fonctions Premium.
          </p>
          <p className="mt-1 text-xs">
            Astuce de test : un numéro se terminant par 0 simule un échec de paiement.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {PLAN_OFFERS.map((offer) => (
          <div key={offer.code} className="e-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{offer.nameFr}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {offer.perMonthLabel}
                </p>
              </div>
              <p className="e-display text-lg">{formatXof(offer.priceCents)}</p>
            </div>
            <CheckoutForm planCode={offer.code} methods={methods.map((m) => ({ code: m.code, label: m.label }))} />
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
        Aucun renouvellement automatique sans votre accord explicite. Nos prix sont calés sur le coût d'un
        forfait data local, pas sur une conversion d'un tarif occidental.
      </p>
    </div>
  );
}
