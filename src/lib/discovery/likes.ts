import { prisma } from "@/lib/db/client";
import { computeMatch } from "@/lib/matching";
import { candidateInclude, toCandidate, type CandidateRow } from "@/lib/matching/from-db";
import { dailyLikeLimit, type Tier } from "@/lib/premium/entitlements";
import { TEMPLATES } from "@/lib/notifications";
import { trustEffects } from "@/lib/trust/signals";

/**
 * §23, §32 — likes et matchs.
 *
 * Le chat ne s'ouvre qu'apres reciprocite (M6, docs/00). C'est la decision qui
 * supprime le vecteur principal de spam et d'arnaque : personne ne peut ecrire
 * a quelqu'un qui ne l'a pas choisi, y compris en payant.
 */

export type LikeOutcome =
  | { status: "LIKED" }
  | { status: "MATCHED"; matchId: string; conversationId: string; score: number }
  | { status: "PASSED" }
  | { status: "BLOCKED_LIMIT"; limit: number }
  | { status: "NOT_ALLOWED"; reason: string };

export async function sendLike(
  fromId: string,
  toId: string,
  kind: "LIKE" | "PASS",
  tier: Tier,
): Promise<LikeOutcome> {
  if (fromId === toId) return { status: "NOT_ALLOWED", reason: "Action impossible." };

  const [sender, target, existingBlock] = await Promise.all([
    prisma.user.findUnique({
      where: { id: fromId },
      select: { id: true, phoneVerified: true, emailVerified: true, status: true, trustScore: true },
    }),
    prisma.user.findUnique({ where: { id: toId }, select: { id: true, status: true } }),
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: fromId, blockedId: toId },
          { blockerId: toId, blockedId: fromId },
        ],
      },
    }),
  ]);

  if (!sender || !target) return { status: "NOT_ALLOWED", reason: "Profil introuvable." };
  if (existingBlock) return { status: "NOT_ALLOWED", reason: "Action impossible." };
  if (target.status !== "ACTIVE") return { status: "NOT_ALLOWED", reason: "Ce profil n'est plus disponible." };

  // §26 : un canal verifie est requis pour interagir. C'est le premier rempart
  // contre les comptes jetables.
  if (!sender.phoneVerified && !sender.emailVerified) {
    return { status: "NOT_ALLOWED", reason: "Vérifiez votre téléphone ou votre e-mail pour pouvoir liker." };
  }
  if (sender.status === "RESTRICTED" || sender.status === "SUSPENDED") {
    return { status: "NOT_ALLOWED", reason: "Votre compte est temporairement restreint." };
  }
  if (trustEffects(sender.trustScore).blockNewMatches) {
    return { status: "NOT_ALLOWED", reason: "Votre compte fait l'objet d'un examen." };
  }

  // Quota quotidien, identique pour tous au sein d'un palier : c'est la mesure
  // qui protege les profils les plus sollicites d'un afflux ingerable.
  if (kind === "LIKE") {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const used = await prisma.like.count({ where: { fromId, kind: "LIKE", createdAt: { gte: since } } });
    const limit = dailyLikeLimit(tier);
    if (used >= limit) return { status: "BLOCKED_LIMIT", limit };
  }

  await prisma.like.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, kind },
    update: { kind },
  });

  if (kind === "PASS") return { status: "PASSED" };

  const reciprocal = await prisma.like.findUnique({
    where: { fromId_toId: { fromId: toId, toId: fromId } },
  });

  if (!reciprocal || reciprocal.kind !== "LIKE") return { status: "LIKED" };

  // --- Match ---------------------------------------------------------------
  // L'ordre des identifiants est normalise pour que la contrainte d'unicite
  // empeche reellement les doublons.
  const [userAId, userBId] = fromId < toId ? [fromId, toId] : [toId, fromId];

  const existing = await prisma.match.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    include: { conversation: true },
  });

  if (existing?.conversation) {
    return {
      status: "MATCHED",
      matchId: existing.id,
      conversationId: existing.conversation.id,
      score: existing.score,
    };
  }

  const [rowA, rowB] = await Promise.all([
    prisma.user.findUnique({ where: { id: userAId }, include: candidateInclude }),
    prisma.user.findUnique({ where: { id: userBId }, include: candidateInclude }),
  ]);

  const candidateA = rowA ? toCandidate(rowA as CandidateRow) : null;
  const candidateB = rowB ? toCandidate(rowB as CandidateRow) : null;
  const result = candidateA && candidateB ? computeMatch(candidateA, candidateB) : null;

  const breakdown = result
    ? Object.fromEntries(
        Object.entries(result.dimensions).map(([key, dimension]) => [
          key,
          dimension.score === null ? null : Math.round(dimension.score * 100),
        ]),
      )
    : {};

  const match = await prisma.match.create({
    data: {
      userAId,
      userBId,
      score: result?.score ?? 0,
      breakdown: JSON.stringify(breakdown),
      conversation: { create: {} },
    },
    include: { conversation: true },
  });

  await notifyMatch(userAId, userBId);
  await notifyMatch(userBId, userAId);

  return {
    status: "MATCHED",
    matchId: match.id,
    conversationId: match.conversation!.id,
    score: match.score,
  };
}

async function notifyMatch(userId: string, otherId: string): Promise<void> {
  const other = await prisma.profile.findUnique({ where: { userId: otherId }, select: { firstName: true } });
  if (!other) return;
  const template = TEMPLATES.newMatch(other.firstName);
  await prisma.notification
    .create({
      data: {
        userId,
        kind: "NEW_MATCH",
        title: template.title,
        body: template.body,
        href: "/app/matchs",
      },
    })
    .catch(() => undefined);
}

export async function remainingLikes(userId: string, tier: Tier): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const used = await prisma.like.count({ where: { fromId: userId, kind: "LIKE", createdAt: { gte: since } } });
  return Math.max(0, dailyLikeLimit(tier) - used);
}

export async function currentTier(userId: string): Promise<Tier> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gte: new Date() } },
    select: { id: true },
  });
  return subscription ? "PREMIUM" : "FREE";
}
