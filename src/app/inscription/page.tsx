import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { BrandLink, PROMISE } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Créer mon profil",
  description: "Créez votre profil EDENIA en quelques minutes, avec un numéro de téléphone ou une adresse e-mail.",
  robots: { index: true, follow: true },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (user) redirect(user.profilePublished ? "/app/decouvrir" : "/app/onboarding");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <BrandLink />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <AuthForm mode="signup" />
          <p className="text-xs text-center mt-8" style={{ color: "var(--fg-muted)" }}>
            {PROMISE}
          </p>
        </div>
      </div>
    </div>
  );
}
