import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { formatXof } from "@/lib/premium/entitlements";
import { SimulatedCheckout } from "@/components/simulated-checkout";

export const metadata = { title: "Checkout simulé", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (env.PAYMENT_PROVIDER !== "simulated") notFound();

  const { ref } = await params;
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
