import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { loadProfileFor } from "@/lib/discovery/service";
import { ProfileActions } from "@/components/profile-actions";
import { Avatar, Chip, CompatibilityMeter } from "@/components/ui";
import { LEVELS } from "@/lib/verification/levels";

export const metadata = { title: "Profil", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const loaded = await loadProfileFor(user.id, id);
  if (!loaded) notFound();

  const { profile, score, explanation } = loaded;
  const photo = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];

  return (
    <div className="space-y-5">
      <Link href="/app/decouvrir" className="e-btn e-btn-ghost">
        ← Retour
      </Link>

      <header className="flex items-start gap-4">
        <Avatar firstName={profile.firstName} url={photo?.url} size={80} />
        <div>
          <h1 className="e-display text-2xl">
            {profile.firstName}, {profile.age} ans
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {[profile.profession, profile.cityLabel, profile.countryLabel].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            {profile.activityLabel}
          </p>
        </div>
      </header>

      {/* §30 : le badge dit ce qui a été contrôlé, et ce que cela ne prouve pas. */}
      {profile.badges.hasEdeniaBadge && (
        <section className="e-card p-4">
          <p className="font-semibold">🛡️ Profil vérifié EDENIA</p>
          <ul className="mt-2 space-y-2 text-sm">
            {profile.badges.identityVerified && (
              <li>
                <strong>{LEVELS.IDENTITY.label}</strong> — {LEVELS.IDENTITY.meaning}
              </li>
            )}
            {profile.badges.profileVerified && (
              <li>
                <strong>{LEVELS.PROFILE.label}</strong> — {LEVELS.PROFILE.meaning}
              </li>
            )}
            {profile.badges.churchVerified && (
              <li>
                <strong>{LEVELS.CHURCH.label}</strong> — {LEVELS.CHURCH.meaning}
              </li>
            )}
          </ul>
          <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
            EDENIA ne garantit jamais les intentions d'une personne. Restez prudent(e) comme dans toute
            rencontre.
          </p>
        </section>
      )}

      <section className="e-card p-4">
        <CompatibilityMeter score={score} caption={explanation.disclaimer} />
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Pourquoi cette personne ?
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {explanation.why.map((reason) => (
              <li key={reason}>✓ {reason}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            Points à découvrir
          </p>
          <ul className="mt-1.5 space-y-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            {explanation.toDiscover.map((point) => (
              <li key={point}>· {point}</li>
            ))}
          </ul>
        </div>
      </section>

      {profile.bio && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Ma présentation</h2>
          <p className="text-sm mt-2">{profile.bio}</p>
        </section>
      )}

      {profile.faith && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Ma foi</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            {profile.faith.denomination && <Row label="Dénomination" value={profile.faith.denomination} />}
            {profile.faith.commitmentLabel && <Row label="Engagement" value={profile.faith.commitmentLabel} />}
            {profile.faith.attendanceLabel && <Row label="Participation" value={profile.faith.attendanceLabel} />}
            {profile.faith.churchName && <Row label="Église" value={profile.faith.churchName} />}
          </dl>
          {profile.faith.faithInCouple && (
            <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
              « {profile.faith.faithInCouple} »
            </p>
          )}
        </section>
      )}

      {profile.marriage && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Mon projet de mariage</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            {profile.marriage.wantsMarriageLabel && <Row label="Mariage" value={profile.marriage.wantsMarriageLabel} />}
            {profile.marriage.timelineLabel && <Row label="Horizon" value={profile.marriage.timelineLabel} />}
            {profile.marriage.wantsChildrenLabel && <Row label="Enfants" value={profile.marriage.wantsChildrenLabel} />}
            {profile.marriage.residenceLabel && <Row label="Foyer" value={profile.marriage.residenceLabel} />}
          </dl>
        </section>
      )}

      {profile.interests.length > 0 && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Centres d'intérêt</h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.interests.map((interest) => (
              <Chip key={interest}>{interest}</Chip>
            ))}
          </div>
        </section>
      )}

      <ProfileActions targetId={profile.userId} firstName={profile.firstName} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: "var(--fg-muted)" }}>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
