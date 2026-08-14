import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { formatXof } from "@/lib/premium/entitlements";
import { isDonationRef } from "@/lib/donations/service";
import { SimulatedCheckout } from "@/components/simulated-checkout";

export const metadata = { title: "Checkout simulé", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  if (env.PAYMENT_PROVIDER !== "simulated") notFound();

  const { ref } = await params;

  // Un don peut être fait sans compte : on ne force la connexion que pour les
  // abonnements, et pour les dons déjà rattachés à un utilisateur.
  if (isDonationRef(ref)) {
    const donation = await prisma.donation.findUnique({ where: { orderRef: ref } });
    if (!donation) notFound();
    if (donation.userId) {
      const user = await getCurrentUser();
      if (!user) redirect("/connexion");
      if (user.id !== donation.userId) notFound();
    }
    return (
      <SimulatedCheckout
        orderRef={donation.orderRef}
        amountLabel={formatXof(donation.amountCents)}
        planName="Soutien volontaire"
        endpoint="/api/v1/donations/simulate"
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const payment = await prisma.payment.findUnique({ where: { orderRef: ref }, include: { plan: true } });
  if (!payment || payment.userId !== user.id) notFound();

  return (
    <SimulatedCheckout
      orderRef={payment.orderRef}
      amountLabel={formatXof(payment.amountCents)}
      planName={payment.plan?.nameFr ?? "Premium"}
    />
  );
}
