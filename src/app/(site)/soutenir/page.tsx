import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isFreeLaunch } from "@/lib/config/monetization";
import { donationsOpen } from "@/lib/donations/service";
import { DonationForm } from "@/components/donation-form";

export const metadata = {
  title: "Soutenir EDENIA",
  description:
    "EDENIA est gratuite pour tous. Si vous le pouvez et le souhaitez, votre don aide à la maintenir accessible.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await donationsOpen())) notFound();
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="e-display text-3xl">Soutenir EDENIA</h1>
      <p className="mt-3" style={{ color: "var(--fg-muted)" }}>
        {isFreeLaunch
          ? "EDENIA est entièrement gratuite. Pas d'abonnement, pas de fonctionnalité réservée, pas de badge à acheter."
          : "EDENIA propose un abonnement, mais tout ce qui touche à la sécurité reste gratuit."}
      </p>

      <div className="e-card p-4 mt-6">
        <p className="text-sm font-semibold">Ce que votre don finance</p>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>
          <li>· L&apos;hébergement et les SMS de vérification.</li>
          <li>· Le temps humain de modération et de vérification des profils.</li>
          <li>· L&apos;ouverture de la plateforme à de nouveaux pays.</li>
        </ul>
      </div>

      <div className="e-card p-4 mt-3" style={{ borderColor: "var(--color-gold-400)" }}>
        <p className="text-sm font-semibold">Ce que votre don ne vous donne pas</p>
        <p className="text-sm mt-1.5" style={{ color: "var(--fg-muted)" }}>
          Aucun badge, aucune vérification accélérée, aucune visibilité supplémentaire, aucune place
          privilégiée dans les suggestions, aucun quota augmenté. Un membre qui ne donne rien a
          exactement le même accès que vous. La vérification n&apos;est pas à vendre — elle ne l&apos;a jamais
          été et ne le sera pas.
        </p>
      </div>

      <div className="mt-6">
        <DonationForm signedIn={user !== null} />
      </div>
    </div>
  );
}
