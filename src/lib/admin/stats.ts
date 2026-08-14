import { prisma } from "@/lib/db/client";

/**
 * §21, §51, §53 — les chiffres du back-office.
 *
 * Deux partis pris qui expliquent la forme de ce fichier :
 *
 * 1. **On ne fabrique jamais un chiffre.** Une etape que nous ne mesurons pas
 *    est rendue avec `measured: false` et un motif, pas avec un zero ou une
 *    estimation. Un entonnoir dont la premiere marche est inventee ne sert a
 *    rien : on prendrait des decisions sur du vent.
 *
 * 2. **Le KPI principal reste la conversation engagee** (§53). Le nombre
 *    d'inscrits est un chiffre de vanite pour une plateforme de mariage.
 */

const DAY = 86_400_000;

export interface ActiveUsers {
  dau: number;
  wau: number;
  mau: number;
  /** DAU/MAU : la « collance » du produit. Sous 10 %, l'usage est occasionnel. */
  stickiness: number | null;
}

export async function activeUsers(now = new Date()): Promise<ActiveUsers> {
  const [dau, wau, mau] = await Promise.all([
    countActiveSince(new Date(now.getTime() - DAY)),
    countActiveSince(new Date(now.getTime() - 7 * DAY)),
    countActiveSince(new Date(now.getTime() - 30 * DAY)),
  ]);
  return {
    dau,
    wau,
    mau,
    stickiness: mau > 0 ? Math.round((dau / mau) * 1000) / 10 : null,
  };
}

function countActiveSince(since: Date): Promise<number> {
  return prisma.user.count({
    where: { status: "ACTIVE", lastActiveAt: { gte: since } },
  });
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** False quand l'etape n'est pas instrumentee : on l'affiche sans chiffre. */
  measured: boolean;
  note?: string;
}

/**
 * §51 — entonnoir d'activation.
 *
 * La premiere marche demandee, « visite », suppose une mesure d'audience
 * anonyme que nous n'avons pas : pas de tag analytique, pas de compteur de
 * pages cote serveur retenu (§47, minimisation). Elle est donc affichee comme
 * non mesuree plutot que remplie avec le nombre d'inscrits, ce qui donnerait un
 * taux de conversion de 100 % — flatteur et faux.
 */
export async function activationFunnel(): Promise<FunnelStep[]> {
  const [
    signups,
    profileStarted,
    profileCompleted,
    withPhoto,
    published,
    firstLike,
    firstMatch,
    firstConversation,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: "DELETED" } } }),
    prisma.profile.count(),
    prisma.profile.count({ where: { completeness: { gte: 80 } } }),
    prisma.user.count({ where: { photos: { some: {} } } }),
    prisma.profile.count({ where: { isPublished: true } }),
    prisma.user.count({ where: { likesSent: { some: { kind: "LIKE" } } } }),
    prisma.user.count({
      where: {
        OR: [{ matchesA: { some: {} } }, { matchesB: { some: {} } }],
      },
    }),
    prisma.user.count({ where: { messages: { some: {} } } }),
  ]);

  return [
    {
      key: "visit",
      label: "Visite du site",
      count: 0,
      measured: false,
      note: "Non instrumenté : aucune mesure d'audience anonyme n'est en place.",
    },
    { key: "signup", label: "Inscription", count: signups, measured: true },
    { key: "profile_started", label: "Profil commencé", count: profileStarted, measured: true },
    {
      key: "profile_completed",
      label: "Profil terminé",
      count: profileCompleted,
      measured: true,
      note: "Complétude ≥ 80 %.",
    },
    { key: "photo", label: "Photo ajoutée", count: withPhoto, measured: true },
    { key: "published", label: "Profil publié", count: published, measured: true },
    { key: "first_like", label: "Premier like", count: firstLike, measured: true },
    { key: "first_match", label: "Premier match", count: firstMatch, measured: true },
    {
      key: "first_conversation",
      label: "Première conversation",
      count: firstConversation,
      measured: true,
      note: "A envoyé au moins un message.",
    },
  ];
}

export interface EngagementRates {
  /** Part des profils publiés parmi les comptes non supprimés. */
  publicationRate: number | null;
  /** Complétude moyenne des profils existants. */
  averageCompleteness: number | null;
  /** Part des membres publiés ayant au moins un match. */
  matchingRate: number | null;
  /** Part des matchs ayant donné lieu à au moins un message. */
  conversationAfterMatchRate: number | null;
  /** Part des matchs où les deux personnes ont écrit — la vraie réciprocité. */
  mutualConversationRate: number | null;
  matches: number;
  conversationsWithMessage: number;
}

export async function engagementRates(): Promise<EngagementRates> {
  const [users, profiles, published, completenessAgg, matches, conversationsWithMessage, matchedUsers] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: "DELETED" } } }),
      prisma.profile.count(),
      prisma.profile.count({ where: { isPublished: true } }),
      prisma.profile.aggregate({ _avg: { completeness: true } }),
      prisma.match.count(),
      prisma.conversation.count({ where: { messages: { some: {} } } }),
      prisma.user.count({
        where: {
          profile: { isPublished: true },
          OR: [{ matchesA: { some: {} } }, { matchesB: { some: {} } }],
        },
      }),
    ]);

  // Réciprocité réelle : un match où une seule personne a écrit n'est pas une
  // conversation, c'est un message resté sans réponse.
  const mutual = await countMutualConversations();

  return {
    publicationRate: users > 0 ? round1((published / users) * 100) : null,
    averageCompleteness: profiles > 0 ? Math.round(completenessAgg._avg.completeness ?? 0) : null,
    matchingRate: published > 0 ? round1((matchedUsers / published) * 100) : null,
    conversationAfterMatchRate: matches > 0 ? round1((conversationsWithMessage / matches) * 100) : null,
    mutualConversationRate: matches > 0 ? round1((mutual / matches) * 100) : null,
    matches,
    conversationsWithMessage,
  };
}

async function countMutualConversations(): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where: { messages: { some: {} } },
    select: { messages: { select: { senderId: true }, distinct: ["senderId"], take: 2 } },
  });
  return conversations.filter((conversation) => conversation.messages.length >= 2).length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface ModerationLoad {
  openReports: number;
  pendingVerifications: number;
  photosPending: number;
  photosReviewRequired: number;
}

export async function moderationLoad(): Promise<ModerationLoad> {
  const [openReports, pendingVerifications, photosPending, photosReviewRequired] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.verificationRequest.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] } } }),
    prisma.photo.count({ where: { moderationStatus: "PENDING" } }),
    prisma.photo.count({ where: { moderationStatus: "REVIEW_REQUIRED" } }),
  ]);
  return { openReports, pendingVerifications, photosPending, photosReviewRequired };
}
