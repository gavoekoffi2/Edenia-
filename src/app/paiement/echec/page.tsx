import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PaymentResult } from "@/components/payment-result";

export const metadata = { title: "Paiement", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const { ref } = await searchParams;
  if (!ref) redirect("/app/premium");

  return <PaymentResult orderRef={ref} expected="ERROR" />;
}
