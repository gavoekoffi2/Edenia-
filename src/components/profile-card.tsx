import Link from "next/link";
import { Avatar, Chip, CompatibilityMeter } from "@/components/ui";
import type { PublicProfile } from "@/lib/db/serialize";
import type { MatchExplanation } from "@/lib/matching";

/**
 * §21 — un profil n'est jamais présenté avec un score nu. La carte impose
 * l'explication : « Pourquoi cette personne ? » et « Points à découvrir ».
 */
export function ProfileCard({
  profile,
  score,
  explanation,
}: {
  profile: PublicProfile;
  score: number;
  explanation: MatchExplanation;
}) {
  const photo = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];

  return (
    <article className="e-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar firstName={profile.firstName} url={photo?.url} size={64} />
          <div className="min-w-0 flex-1">
            <h3 className="e-display text-lg">
              {profile.firstName}, {profile.age} ans
            </h3>
            <p className="text-sm truncate" style={{ color: "var(--fg-muted)" }}>
              {[profile.profession, profile.cityLabel].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {profile.badges.hasEdeniaBadge && <Chip variant="verified">🛡️ Profil vérifié</Chip>}
              {profile.badges.churchVerified && <Chip variant="verified">⛪ Église vérifiée</Chip>}
              {profile.isDiaspora && <Chip>🌍 Diaspora</Chip>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <CompatibilityMeter score={score} caption={explanation.disclaimer} />
        </div>

        {explanation.lowDataNotice && (
          <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
            {explanation.lowDataNotice}
          </p>
        )}

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Pourquoi cette personne ?
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {explanation.why.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden="true" style={{ color: "var(--color-success-600)" }}>
                  ✓
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Points à découvrir
          </p>
          <ul className="mt-1.5 space-y-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            {explanation.toDiscover.map((point) => (
              <li key={point} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {profile.bio && <p className="text-sm mt-4">{profile.bio}</p>}

        <div className="flex gap-2 mt-4">
          <Link href={`/app/profils/${profile.userId}`} className="e-btn e-btn-secondary flex-1">
            Voir le profil
          </Link>
        </div>
      </div>
    </article>
  );
}
