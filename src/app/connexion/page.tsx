import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Se connecter",
  description: "Connectez-vous à votre compte EDENIA.",
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
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
