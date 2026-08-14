import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { PHOTO_MODERATION_LABEL, type PhotoModerationStatus } from "@/lib/storage/photos";
import { PhotoModerationQueue } from "@/components/admin-photo-moderation";

export const metadata = { title: "Profils", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: string; label: string; statuses: PhotoModerationStatus[] }> = [
  { key: "a-traiter", label: "À traiter", statuses: ["REVIEW_REQUIRED", "PENDING"] },
  { key: "doute", label: "Doutes", statuses: ["REVIEW_REQUIRED"] },
  { key: "attente", label: "En attente", statuses: ["PENDING"] },
  { key: "refusees", label: "Refusées", statuses: ["REJECTED"] },
  { key: "approuvees", label: "Approuvées", statuses: ["APPROVED"] },
];

/**
 * §35 — profils et photos.
 *
 * Les doutes du contrôle automatique passent en premier, avant la file
 * ordinaire : c'est le seul ordre qui a du sens quand le temps humain est la
 * ressource rare.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdminPage("photos.moderate");
  const { f } = await searchParams;

  const filter = FILTERS.find((item) => item.key === f) ?? FILTERS[0]!;

  const [counts, photos, profileStats] = await Promise.all([
    prisma.photo.groupBy({ by: ["moderationStatus"], _count: true }),
    prisma.photo.findMany({
      where: { moderationStatus: { in: filter.statuses } },
      include: { user: { select: { profile: { select: { firstName: true } } } } },
      // REVIEW_REQUIRED avant PENDING : l'ordre alphabétique inverse fait
      // exactement cela, sans requête supplémentaire.
      orderBy: [{ moderationStatus: "desc" }, { createdAt: "asc" }],
      take: 40,
    }),
    prisma.profile.aggregate({ _count: true, _avg: { completeness: true } }),
  ]);

  const byStatus = new Map(counts.map((row) => [row.moderationStatus, row._count]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Profils</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {profileStats._count.toLocaleString("fr-FR")} profil(s) · complétude moyenne{" "}
          {Math.round(profileStats._avg.completeness ?? 0)} %.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["REVIEW_REQUIRED", "PENDING", "APPROVED", "REJECTED"] as PhotoModerationStatus[]).map((status) => (
          <div
            key={status}
            className="e-card p-3"
            style={
              status === "REVIEW_REQUIRED" && (byStatus.get(status) ?? 0) > 0
                ? { borderColor: "var(--color-gold-400)" }
                : undefined
            }
          >
            <p className="e-display text-xl">{(byStatus.get(status) ?? 0).toLocaleString("fr-FR")}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {PHOTO_MODERATION_LABEL[status]}
            </p>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtres">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/profils?f=${item.key}`}
            className={item.key === filter.key ? "e-btn e-btn-primary" : "e-btn e-btn-secondary"}
            style={{ minHeight: "2.25rem", padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <PhotoModerationQueue
        photos={photos.map((photo) => ({
          id: photo.id,
          url: `/media/${photo.storageKey}`,
          firstName: photo.user.profile?.firstName ?? "Sans nom",
          submittedAt: photo.createdAt.toISOString(),
          status: photo.moderationStatus,
          autoReason: photo.moderationReason,
        }))}
      />

      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
        Le contrôle automatique ne vérifie que des critères objectifs — dimensions, format, densité de
        l&apos;image. Il ne détecte ni nudité, ni violence, ni absence de visage : ces jugements demandent un
        service de vision qui n&apos;est pas branché, et nous ne prétendons pas le contraire.
      </p>
    </div>
  );
}
