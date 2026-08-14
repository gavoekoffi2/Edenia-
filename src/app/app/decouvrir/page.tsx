import Link from "next/link";
import { DISCOVERY_RAIL, RAIL_LABEL, type DiscoveryRail } from "@/lib/config/enums";
import { requireUser } from "@/lib/auth/current-user";
import { discover } from "@/lib/discovery/service";
import { currentTier, remainingLikes } from "@/lib/discovery/likes";
import { ProfileActions } from "@/components/profile-actions";
import { ProfileCard } from "@/components/profile-card";
import { EmptyState } from "@/components/ui";
import { premiumIsPublic } from "@/lib/config/monetization";
import { getBooleanSetting } from "@/lib/settings/service";

export const metadata = { title: "Découvrir", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ rail?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;

  const rail = (DISCOVERY_RAIL as readonly string[]).includes(params.rail ?? "")
    ? (params.rail as DiscoveryRail)
    : "for-you";

  /*
   * §22 — la decouverte peut etre suspendue depuis le back-office, par exemple
   * le temps de traiter une vague de signalements. Les conversations en cours
   * ne sont pas coupees pour autant : on arrete de presenter de nouvelles
   * personnes, on n'isole personne de celles qu'il connait deja.
   */
  const discoveryOpen = await getBooleanSetting("access.discovery_open");
  if (!discoveryOpen) {
    return (
      <div className="space-y-5">
        <h1 className="e-display text-xl">Découverte en pause</h1>
        <EmptyState
          title="La découverte est momentanément suspendue"
          body="Notre équipe travaille sur la plateforme. Vos matchs et vos conversations restent accessibles normalement."
          action={{ label: "Voir mes messages", href: "/app/messages" }}
        />
      </div>
    );
  }

  const tier = await currentTier(user.id);
  const [cards, likesLeft] = await Promise.all([
    discover(user.id, { rail, tier }),
    remainingLikes(user.id, tier),
  ]);

  const label = RAIL_LABEL[rail];

  return (
    <div className="space-y-5">
      {/* §23 : les six rails, annoncés par leur logique de tri. */}
      <nav className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" aria-label="Modes de découverte">
        {DISCOVERY_RAIL.map((key) => {
          const item = RAIL_LABEL[key];
          const active = key === rail;
          return (
            <Link
              key={key}
              href={`/app/decouvrir?rail=${key}`}
              className={active ? "e-btn e-btn-primary" : "e-btn e-btn-secondary"}
              style={{ minHeight: "2.25rem", fontSize: "0.8125rem", padding: "0.375rem 0.875rem", whiteSpace: "nowrap" }}
            >
              {item.emoji} {item.title}
            </Link>
          );
        })}
      </nav>

      <div>
        <h1 className="e-display text-xl">
          {label.emoji} {label.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {label.subtitle}
        </p>
      </div>

      {premiumIsPublic && tier === "FREE" && rail === "verified" && (
        <div className="e-card p-3 text-sm" style={{ borderColor: "var(--color-gold-400)" }}>
          Aperçu limité à 3 profils vérifiés par jour. Le badge reste visible partout, gratuitement —
          Premium ne débloque que le filtre.{" "}
          <Link href="/app/premium" className="underline">
            Voir Premium
          </Link>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          title="Pas de profil à afficher ici pour l'instant"
          body={
            rail === "for-you"
              ? "EDENIA se déploie ville par ville pour garantir une vraie densité. Complétez votre profil pour améliorer vos recommandations, et revenez bientôt."
              : "Essayez un autre mode de découverte, ou élargissez vos préférences."
          }
          action={{ label: "Ajuster mes préférences", href: "/app/parametres" }}
        />
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <div key={card.profile.userId}>
              <ProfileCard profile={card.profile} score={card.score} explanation={card.explanation} />
              <ProfileActions targetId={card.profile.userId} firstName={card.profile.firstName} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>
        {likesLeft} like{likesLeft > 1 ? "s" : ""} restant{likesLeft > 1 ? "s" : ""} aujourd'hui.
        Ce plafond existe pour que chacun reçoive une attention gérable.
      </p>
    </div>
  );
}
