import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { toPublicProfile, type PublicProfile } from "@/lib/db/serialize";
import { computeMatch, explainMatch, type MatchExplanation } from "@/lib/matching";
import { candidateInclude, toCandidate, type CandidateRow } from "@/lib/matching/from-db";
import { railLimit, type Tier } from "@/lib/premium/entitlements";
import { trustEffects } from "@/lib/trust/signals";
import type { DiscoveryRail } from "@/lib/config/enums";

/**
 * §23 — les six rails de decouverte.
 *
 * Choix structurant : **la recence ne pilote jamais le classement**, sauf dans
 * le rail « Nouveaux profils » qui l'annonce. Trier par derniere connexion
 * revient a recompenser l'assiduite plutot que la pertinence, et c'est le
 * mecanisme qui transforme une plateforme de mariage en machine a scroller.
 */

export interface DiscoveryCard {
  profile: PublicProfile;
  score: number;
  explanation: MatchExplanation;
}

export interface DiscoverOptions {
  rail: DiscoveryRail;
  tier: Tier;
  limit?: number;
  /** Premium uniquement : n'afficher que les profils verifies. */
  verifiedOnly?: boolean;
}

const SERIALIZE_INCLUDE = {
  ...candidateInclude,
  photos: true,
} satisfies Prisma.UserInclude;

type Row = Prisma.UserGetPayload<{ include: typeof SERIALIZE_INCLUDE }>;

export async function discover(viewerId: string, options: DiscoverOptions): Promise<DiscoveryCard[]> {
  const viewerRow = await prisma.user.findUnique({ where: { id: viewerId }, include: candidateInclude });
  if (!viewerRow) return [];

  const viewer = toCandidate(viewerRow as CandidateRow);
  if (!viewer) return [];

  const max = options.limit ?? railLimit(options.tier, options.rail);

  // --- Filtres durs cote base : on ne charge pas ce qu'on va jeter ----------
  const [blockedByMe, blockedMe, alreadySeen] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
    prisma.like.findMany({ where: { fromId: viewerId }, select: { toId: true } }),
  ]);

  const excluded = new Set<string>([
    viewerId,
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
    ...alreadySeen.map((l) => l.toId),
  ]);

  // Les conditions s'empilent dans un AND : deux cles `OR` dans un meme objet
  // se recouvriraient silencieusement, et on perdrait le filtre de verification.
  const conditions: Prisma.UserWhereInput[] = [
    // §26 : un compte sans canal verifie n'entre jamais dans la decouverte.
    { OR: [{ phoneVerified: true }, { emailVerified: true }] },
  ];

  if (options.rail === "verified" || options.verifiedOnly) {
    conditions.push({
      OR: [
        { identityVerification: { status: "APPROVED" } },
        { profileVerification: { status: "APPROVED" } },
        { churchVerification: { status: "APPROVED" } },
      ],
    });
  }

  if (options.rail === "new") {
    conditions.push({ createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } });
  }

  const where: Prisma.UserWhereInput = {
    id: { notIn: [...excluded] },
    status: "ACTIVE",
    profile: {
      isPublished: true,
      gender: viewer.core.seeking,
      seeking: viewer.core.gender,
      ...railGeoFilter(options.rail, viewer),
    },
    AND: conditions,
  };

  // On sur-echantillonne : les criteres essentiels (§22) s'evaluent en memoire
  // et retirent une partie des candidats.
  const rows = (await prisma.user.findMany({
    where,
    include: SERIALIZE_INCLUDE,
    take: Math.max(max * 6, 40),
    orderBy: options.rail === "new" ? { createdAt: "desc" } : { lastActiveAt: "desc" },
  })) as Row[];

  const cards: DiscoveryCard[] = [];

  for (const row of rows) {
    const candidate = toCandidate(row as CandidateRow);
    if (!candidate) continue;

    // §34 : un compte en zone critique n'est plus propose.
    if (trustEffects(row.trustScore).blockNewMatches) continue;

    const result = computeMatch(viewer, candidate);
    if (result.blocked) continue;

    if (options.rail === "high-compatibility" && result.score < 75) continue;

    const publicProfile = toPublicProfile(row, { isMatched: false });
    if (!publicProfile) continue;

    cards.push({
      profile: publicProfile,
      score: result.score,
      explanation: explainMatch(viewer, candidate, result, { isMatched: false }),
    });
  }

  // §23 : chaque rail a son propre critere de tri, annonce a l'utilisateur.
  if (options.rail === "new") {
    // Deja trie par date cote base — on conserve l'ordre.
  } else if (options.rail === "near-you") {
    const viewerCity = viewerRow.profile?.city?.nameFr ?? null;
    cards.sort((a, b) => {
      const localityA = viewerCity && a.profile.cityLabel === viewerCity ? 1 : 0;
      const localityB = viewerCity && b.profile.cityLabel === viewerCity ? 1 : 0;
      return localityB - localityA || b.score - a.score;
    });
  } else {
    cards.sort((a, b) => b.score - a.score);
  }

  return cards.slice(0, max);
}

function railGeoFilter(rail: DiscoveryRail, viewer: ReturnType<typeof toCandidate>): Prisma.ProfileWhereInput {
  if (!viewer) return {};
  switch (rail) {
    case "near-you":
      return viewer.location.regionId ? { regionId: viewer.location.regionId } : {};
    case "diaspora":
      return { isDiaspora: true };
    case "for-you":
    case "high-compatibility":
      return viewer.location.countryCode && viewer.preferences.scope === "CITY"
        ? { countryCode: viewer.location.countryCode }
        : {};
    default:
      return {};
  }
}

/** Profil complet consulte depuis la decouverte ou une conversation. */
export async function loadProfileFor(
  viewerId: string,
  targetId: string,
): Promise<{ profile: PublicProfile; score: number; explanation: MatchExplanation } | null> {
  const [viewerRow, targetRow, match] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, include: candidateInclude }),
    prisma.user.findUnique({ where: { id: targetId }, include: SERIALIZE_INCLUDE }),
    prisma.match.findFirst({
      where: {
        OR: [
          { userAId: viewerId, userBId: targetId },
          { userAId: targetId, userBId: viewerId },
        ],
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  ]);

  if (!viewerRow || !targetRow) return null;

  const viewer = toCandidate(viewerRow as CandidateRow);
  const target = toCandidate(targetRow as CandidateRow);
  if (!viewer || !target) return null;

  const isMatched = match !== null;
  const result = computeMatch(viewer, target);
  const profile = toPublicProfile(targetRow, { isMatched });
  if (!profile) return null;

  // Une consultation de profil est une donnee d'usage, pas un signal public.
  await prisma.profileView
    .create({ data: { viewerId, viewedId: targetId } })
    .catch(() => undefined);

  return {
    profile,
    score: result.score,
    explanation: explainMatch(viewer, target, result, { isMatched }),
  };
}
