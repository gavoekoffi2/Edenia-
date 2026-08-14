import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { PreferencesForm } from "@/components/preferences-form";
import { AccountActions } from "@/components/account-actions";
import { premiumIsPublic } from "@/lib/config/monetization";
import { donationsOpen } from "@/lib/donations/service";

export const metadata = { title: "Paramètres", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const showDonate = !premiumIsPublic && (await donationsOpen());

  const [preferences, dealbreakers, consents] = await Promise.all([
    prisma.preferences.findUnique({ where: { userId: user.id } }),
    prisma.dealbreaker.findMany({ where: { userId: user.id } }),
    prisma.consent.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="e-display text-xl">⚙️ Paramètres</h1>

      <PreferencesForm
        initial={{
          ageMin: preferences?.ageMin ?? 21,
          ageMax: preferences?.ageMax ?? 45,
          scope: preferences?.scope ?? "COUNTRY",
          openToDiaspora: preferences?.openToDiaspora ?? true,
          openToChildren: preferences?.openToChildren ?? true,
        }}
        dealbreakers={dealbreakers.map((rule) => rule.key)}
      />

      <section className="e-card p-4">
        <h2 className="e-display text-lg">Mes consentements</h2>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Vous pouvez retirer un consentement à tout moment. Retirer celui portant sur votre église fait
          disparaître le badge correspondant.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {consents.map((consent) => (
            <li key={consent.id} className="flex justify-between gap-3">
              <span>{CONSENT_LABEL[consent.purpose] ?? consent.purpose}</span>
              <span style={{ color: "var(--fg-muted)" }}>
                {consent.revokedAt ? "Retiré" : consent.granted ? "Accordé" : "Refusé"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="e-card p-4">
        <h2 className="e-display text-lg">Mon compte</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>Téléphone vérifié : {user.phoneVerified ? "oui" : "non"}</li>
          <li>E-mail vérifié : {user.emailVerified ? "oui" : "non"}</li>
        </ul>
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          Un seul canal vérifié suffit. Ajouter le second est facultatif.
        </p>
      </section>

      {premiumIsPublic ? (
        <div className="e-card p-4">
          <Link href="/app/premium" className="font-semibold text-sm">
            ✦ EDENIA Premium
          </Link>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            Filtres avancés et compatibilité détaillée. Aucun badge, aucune priorité de vérification.
          </p>
        </div>
      ) : (
        showDonate && (
          <div className="e-card p-4">
            <Link href="/soutenir" className="font-semibold text-sm">
              ❤️ Soutenir EDENIA
            </Link>
            <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
              EDENIA est gratuite. Un don ne débloque rien — il finance l&apos;hébergement, la modération
              et la vérification des profils.
            </p>
          </div>
        )
      )}

      <AccountActions />
    </div>
  );
}

const CONSENT_LABEL: Record<string, string> = {
  TERMS: "Conditions d'utilisation",
  PRIVACY: "Politique de confidentialité",
  FAITH_PROFILE: "Traitement de mes convictions religieuses",
  CHURCH_VERIFICATION: "Contact de mon église pour vérification",
  AI_PROCESSING: "Traitement par EDENIA AI",
  MARKETING: "Communications marketing",
};
