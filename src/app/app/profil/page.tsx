import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { toPublicProfile } from "@/lib/db/serialize";
import { candidateInclude } from "@/lib/matching/from-db";
import { Avatar, Chip, EmptyState } from "@/components/ui";

export const metadata = { title: "Mon profil", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    include: { ...candidateInclude, photos: true },
  });

  if (!row?.profile) {
    return (
      <EmptyState
        title="Votre profil n'est pas encore créé"
        body="Quelques minutes de conversation avec EDENIA AI suffisent."
        action={{ label: "Créer mon profil", href: "/app/onboarding" }}
      />
    );
  }

  // On se regarde soi-même comme un visiteur : c'est le seul moyen de vérifier
  // concrètement ce que les autres voient (§47).
  const view = toPublicProfile(row, { isMatched: false });
  if (!view) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar firstName={view.firstName} url={view.photos[0]?.url} size={64} />
          <div>
            <h1 className="e-display text-xl">
              {view.firstName}, {view.age} ans
            </h1>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              {[view.profession, view.cityLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <Link href="/app/parametres" className="e-btn e-btn-secondary">
          Modifier
        </Link>
      </div>

      {!row.profile.isPublished && (
        <div className="e-card p-4" style={{ borderColor: "var(--color-gold-400)" }}>
          <p className="font-semibold text-sm">Votre profil n'est pas publié</p>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            Personne ne peut le voir pour l'instant.
          </p>
          <Link href="/app/onboarding/apercu" className="e-btn e-btn-primary mt-3">
            Relire et publier
          </Link>
        </div>
      )}

      <div className="e-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
          Ce que les autres voient
        </p>
        <p className="text-sm mt-2">{view.bio ?? "Aucune présentation pour l'instant."}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {view.badges.phoneVerified && <Chip variant="verified">📱 Téléphone vérifié</Chip>}
          {view.badges.emailVerified && <Chip variant="verified">✉️ E-mail vérifié</Chip>}
          {view.badges.identityVerified && <Chip variant="verified">🪪 Identité vérifiée</Chip>}
          {view.badges.profileVerified && <Chip variant="verified">🛡️ Profil vérifié</Chip>}
          {view.badges.churchVerified && <Chip variant="verified">⛪ Église vérifiée</Chip>}
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
          Ni votre numéro, ni votre e-mail, ni votre date de naissance, ni votre position précise
          n'apparaissent jamais sur votre profil public.
        </p>
      </div>

      <div className="e-card p-4">
        <p className="font-semibold text-sm">Complétude : {row.profile.completeness} %</p>
        <div className="e-meter mt-2">
          <span style={{ width: `${row.profile.completeness}%` }} />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
          Un profil plus complet donne des recommandations plus justes — et un score de compatibilité
          plus fiable pour les personnes qui vous découvrent.
        </p>
      </div>

      <Link href="/app/confiance" className="e-card p-4 block">
        <p className="font-semibold text-sm">🛡️ Faire vérifier mon profil</p>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Gratuit, et sans lien avec un abonnement.
        </p>
      </Link>
    </div>
  );
}
