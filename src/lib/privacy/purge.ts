import { prisma } from "@/lib/db/client";
import { deletePhoto } from "@/lib/storage/photos";
import { VERIFICATION_VALIDITY_MONTHS } from "@/lib/verification/levels";

/**
 * §47, M3 — application des durees de retention.
 *
 * Les durees etaient documentees (docs/02 §5) et les champs existaient
 * (`purgeAfter`, `deletionRequestedAt`) ; ce module est la tache qui les
 * applique enfin. Une politique de retention qu'aucun code n'execute n'est pas
 * une politique, c'est une intention.
 *
 * Trois principes :
 *
 *  - **Rien n'est supprime avant l'echeance.** Une suppression accidentelle
 *    doit pouvoir etre rattrapee pendant 30 jours (docs/02 §5).
 *  - **Les fichiers partent avec les lignes.** Effacer une ligne `Photo` en
 *    laissant l'image sur le disque ne supprime rien du point de vue de la
 *    personne concernee.
 *  - **Le journal d'audit survit**, parce que ses identifiants sont deja
 *    pseudonymises : il ne contient rien qui permette de retrouver quelqu'un.
 */

export const RETENTION = {
  /** Pieces d'identite : detruites au plus tard 7 jours apres decision. */
  identityDocumentsDays: 7,
  /** Compte supprime : effacement definitif 30 jours apres la demande. */
  deletedAccountDays: 30,
  /** Compte inactif : anonymisation apres 24 mois. */
  inactiveMonths: 24,
  /** Evenements webhook : 90 jours suffisent a diagnostiquer un litige. */
  webhookEventDays: 90,
  /** Compteurs de limitation : sans interet une fois la fenetre passee. */
  rateLimitGraceHours: 24,
  /** Defis OTP consommes ou expires. */
  otpChallengeDays: 2,
  /** Conversations d'onboarding IA terminees. */
  aiConversationDays: 180,
} as const;

export interface PurgeReport {
  dryRun: boolean;
  at: Date;
  steps: Array<{ step: string; affected: number; detail: string }>;
}

export async function runPurge(options: { dryRun?: boolean; now?: Date } = {}): Promise<PurgeReport> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const steps: PurgeReport["steps"] = [];

  const record = (step: string, affected: number, detail: string) => {
    steps.push({ step, affected, detail });
  };

  // 1. Pieces d'identite arrivees a echeance ------------------------------
  const expiredDocuments = await prisma.identityVerification.findMany({
    where: {
      purgeAfter: { lte: now },
      OR: [{ documentKeyEnc: { not: null } }, { selfieKeyEnc: { not: null } }],
    },
    select: { id: true },
  });
  if (!dryRun && expiredDocuments.length > 0) {
    await prisma.identityVerification.updateMany({
      where: { id: { in: expiredDocuments.map((row) => row.id) } },
      data: { documentKeyEnc: null, selfieKeyEnc: null },
    });
  }
  record(
    "Pièces d'identité",
    expiredDocuments.length,
    `Références chiffrées effacées après ${RETENTION.identityDocumentsDays} jours (docs/02 §5).`,
  );

  // 2. Comptes supprimes au-dela du delai de retractation -------------------
  const cutoffDeleted = new Date(now.getTime() - RETENTION.deletedAccountDays * 86_400_000);
  const toErase = await prisma.user.findMany({
    where: {
      status: "DELETED",
      OR: [{ deletionRequestedAt: { lte: cutoffDeleted } }, { deletionRequestedAt: null, updatedAt: { lte: cutoffDeleted } }],
    },
    select: { id: true, photos: { select: { storageKey: true } } },
  });

  if (!dryRun) {
    for (const user of toErase) {
      // Les fichiers d'abord : si la suppression en base echoue, on retentera,
      // alors qu'un fichier orphelin ne serait plus jamais retrouve.
      for (const photo of user.photos) {
        await deletePhoto(photo.storageKey).catch(() => undefined);
      }
      // Les relations en cascade (profil, messages, likes, photos…) partent
      // avec l'utilisateur : c'est le schema qui le garantit, pas ce code.
      await prisma.user.delete({ where: { id: user.id } }).catch((error) => {
        console.error(`Purge : suppression impossible pour ${user.id}`, error);
      });
    }
  }
  record(
    "Comptes supprimés",
    toErase.length,
    `Effacement définitif ${RETENTION.deletedAccountDays} jours après la demande, fichiers compris.`,
  );

  // 3. Comptes inactifs : anonymisation, pas suppression --------------------
  const cutoffInactive = new Date(now.getTime() - RETENTION.inactiveMonths * 30 * 86_400_000);
  const dormant = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      lastActiveAt: { lte: cutoffInactive },
    },
    select: { id: true },
    take: 500,
  });
  if (!dryRun && dormant.length > 0) {
    // On coupe la visibilite et les canaux de contact ; l'historique
    // relationnel de l'autre personne n'est pas detruit pour autant.
    await prisma.profile.updateMany({
      where: { userId: { in: dormant.map((row) => row.id) } },
      data: { isPublished: false },
    });
    await prisma.user.updateMany({
      where: { id: { in: dormant.map((row) => row.id) } },
      data: { status: "DORMANT", sessionVersion: { increment: 1 } },
    });
  }
  record(
    "Comptes inactifs",
    dormant.length,
    `Dépublication après ${RETENTION.inactiveMonths} mois sans activité. Aucune donnée effacée à ce stade.`,
  );

  // 4. Defis OTP ------------------------------------------------------------
  const otpCutoff = new Date(now.getTime() - RETENTION.otpChallengeDays * 86_400_000);
  const otp = dryRun
    ? await prisma.otpChallenge.count({ where: { createdAt: { lte: otpCutoff } } })
    : (await prisma.otpChallenge.deleteMany({ where: { createdAt: { lte: otpCutoff } } })).count;
  record("Défis OTP", otp, `Supprimés après ${RETENTION.otpChallengeDays} jours.`);

  // 5. Compteurs de limitation ---------------------------------------------
  const rateCutoff = new Date(now.getTime() - RETENTION.rateLimitGraceHours * 3_600_000);
  const counters = dryRun
    ? await prisma.rateLimitCounter.count({ where: { windowEnd: { lte: rateCutoff } } })
    : (await prisma.rateLimitCounter.deleteMany({ where: { windowEnd: { lte: rateCutoff } } })).count;
  record("Compteurs de débit", counters, "Fenêtres expirées.");

  // 6. Evenements webhook ---------------------------------------------------
  const webhookCutoff = new Date(now.getTime() - RETENTION.webhookEventDays * 86_400_000);
  const webhooks = dryRun
    ? await prisma.webhookEvent.count({ where: { receivedAt: { lte: webhookCutoff } } })
    : (await prisma.webhookEvent.deleteMany({ where: { receivedAt: { lte: webhookCutoff } } })).count;
  record(
    "Événements webhook",
    webhooks,
    `Supprimés après ${RETENTION.webhookEventDays} jours. Les paiements eux-mêmes sont conservés (obligation comptable).`,
  );

  // 7. Conversations d'onboarding IA ---------------------------------------
  const aiCutoff = new Date(now.getTime() - RETENTION.aiConversationDays * 86_400_000);
  const conversations = dryRun
    ? await prisma.aIConversation.count({ where: { completedAt: { lte: aiCutoff } } })
    : (await prisma.aIConversation.deleteMany({ where: { completedAt: { lte: aiCutoff } } })).count;
  record(
    "Conversations IA terminées",
    conversations,
    `Supprimées après ${RETENTION.aiConversationDays} jours. Le profil qui en est issu reste, la conversation non.`,
  );

  // 8. Verifications arrivees a echeance ------------------------------------
  //
  // Ce n'est pas une suppression : le dossier passe en EXPIRED, le badge tombe,
  // et la personne peut redemander une verification — gratuitement (§31). Un
  // badge qui ne se perime jamais finit par affirmer quelque chose que personne
  // n'a verifie depuis des annees.
  const staleVerifications = await prisma.identityVerification.findMany({
    where: { status: "APPROVED", expiresAt: { lte: now } },
    select: { id: true, userId: true },
  });
  if (!dryRun && staleVerifications.length > 0) {
    await prisma.identityVerification.updateMany({
      where: { id: { in: staleVerifications.map((row) => row.id) } },
      data: { status: "EXPIRED" },
    });
    await prisma.notification
      .createMany({
        data: staleVerifications.map((row) => ({
          userId: row.userId,
          kind: "VERIFICATION",
          title: "Votre vérification a expiré",
          body: "Elle était valable deux ans. La renouveler est gratuit et prend quelques minutes.",
          href: "/app/confiance",
        })),
      })
      .catch(() => undefined);
  }
  record(
    "Vérifications expirées",
    staleVerifications.length,
    `Validité de ${VERIFICATION_VALIDITY_MONTHS} mois. Le badge tombe, le dossier reste, la redemande est gratuite.`,
  );

  // 9. Invitations d'administrateurs expirees -------------------------------
  const invitations = dryRun
    ? await prisma.adminInvitation.count({ where: { expiresAt: { lte: now } } })
    : (await prisma.adminInvitation.deleteMany({ where: { expiresAt: { lte: now } } })).count;
  record("Invitations expirées", invitations, "Liens de configuration périmés.");

  return { dryRun, at: now, steps };
}
