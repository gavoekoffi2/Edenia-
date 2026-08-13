import { requireUser } from "@/lib/auth/current-user";
import { currentTier } from "@/lib/discovery/likes";
import { prisma } from "@/lib/db/client";
import { PLAN_OFFERS, formatXof } from "@/lib/premium/entitlements";
import { methodsForCountry } from "@/lib/payments/provider";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata = { title: "EDENIA Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const [tier, profile] = await Promise.all([
    currentTier(user.id),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { countryCode: true } }),
  ]);

  const methods = methodsForCountry(profile?.countryCode ?? "TG");

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
