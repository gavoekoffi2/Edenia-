import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { formatXof } from "@/lib/premium/entitlements";

export const metadata = { title: "Merci", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §10 — comme pour les abonnements, l'arrivée sur cette page ne prouve rien.
 * On lit l'état réel du don en base ; s'il n'est pas encore confirmé, on le dit
 * plutôt que de remercier pour un paiement qui n'a peut-être pas abouti.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const donation = ref ? await prisma.donation.findUnique({ where: { orderRef: ref } }) : null;
  const confirmed = donation?.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {confirmed ? (
        <>
          <p className="text-4xl">❤️</p>
          <h1 className="e-display text-3xl mt-3">Merci.</h1>
          <p className="mt-3" style={{ color: "var(--fg-muted)" }}>
            Votre don de {formatXof(donation.amountCents)} est bien enregistré. Il aide EDENIA à rester
            gratuite pour tout le monde.
          </p>
          <p className="text-sm mt-4" style={{ color: "var(--fg-muted)" }}>
            Votre compte n&apos;a pas changé : vous aviez déjà accès à tout.
          </p>
        </>
      ) : (
        <>
          <h1 className="e-display text-2xl">Don en cours de confirmation</h1>
          <p className="mt-3" style={{ color: "var(--fg-muted)" }}>
            Nous n&apos;avons pas encore reçu la confirmation de l&apos;opérateur. Cela prend en général moins
            d&apos;une minute. Aucun besoin de recommencer : si le paiement a été accepté, il sera
            enregistré automatiquement.
          </p>
          {donation && (
            <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
              Référence : {donation.orderRef}
            </p>
          )}
        </>
      )}

      <Link href="/" className="e-btn e-btn-secondary mt-6">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
