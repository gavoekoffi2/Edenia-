import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { OnboardingChat } from "@/components/onboarding-chat";

export const metadata = { title: "Créons votre profil", robots: { index: false } };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.profilePublished) redirect("/app/decouvrir");

  return <OnboardingChat />;
}
