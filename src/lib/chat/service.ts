import { prisma } from "@/lib/db/client";
import { scanMessage } from "@/lib/trust/signals";
import { TEMPLATES } from "@/lib/notifications";

/**
 * §32, §33, §34 — messagerie.
 *
 * Chaque message est analyse avant enregistrement. Quand un motif d'arnaque est
 * detecte, deux choses se produisent en meme temps : le destinataire recoit un
 * avertissement, et un signal interne part vers la moderation. L'expediteur
 * n'est pas informe de la detection — le prevenir reviendrait a lui apprendre
 * a la contourner.
 */

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  /** §34 : avertissement affiche au destinataire. */
  warning?: string | null;
  error?: string;
}

export async function sendMessage(
  senderId: string,
  conversationId: string,
  body: string,
): Promise<SendMessageResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { match: true },
  });

  if (!conversation) return { ok: false, error: "Conversation introuvable." };
  if (conversation.status !== "ACTIVE" || conversation.match.status !== "ACTIVE") {
    return { ok: false, error: "Cette conversation est fermée." };
  }

  const { userAId, userBId } = conversation.match;
  if (senderId !== userAId && senderId !== userBId) {
    return { ok: false, error: "Conversation introuvable." };
  }

  const recipientId = senderId === userAId ? userBId : userAId;

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: recipientId },
        { blockerId: recipientId, blockedId: senderId },
      ],
    },
  });
  if (blocked) return { ok: false, error: "Cette conversation est fermée." };

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { status: true, profile: { select: { firstName: true } } },
  });
  if (sender?.status === "SUSPENDED" || sender?.status === "BANNED") {
    return { ok: false, error: "Votre compte ne peut pas envoyer de messages." };
  }

  const scan = scanMessage(body);

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      kind: "TEXT",
      body,
      flagged: scan.flagForReview,
      flagReason: scan.signals.map((signal) => signal.kind).join(",") || null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  for (const signal of scan.signals) {
    await prisma.trustSignal
      .create({
        data: {
          userId: senderId,
          kind: signal.kind,
          weight: signal.weight,
          detail: signal.detail,
          sourceRef: message.id,
        },
      })
      .catch(() => undefined);
  }

  // Une demande d'argent caracterisee est signalee d'office : on n'attend pas
  // que la personne visee ose le faire elle-meme.
  if (scan.signals.some((signal) => signal.kind === "MONEY_REQUEST")) {
    await prisma.report
      .create({
        data: {
          reporterId: recipientId,
          reportedId: senderId,
          category: "SCAM_MONEY",
          detail: "Signalement automatique : demande d'argent détectée dans un message.",
          messageId: message.id,
          severity: "HIGH",
        },
      })
      .catch(() => undefined);
  }

  const template = TEMPLATES.newMessage(sender?.profile?.firstName ?? "Un membre");
  await prisma.notification
    .create({
      data: {
        userId: recipientId,
        kind: "NEW_MESSAGE",
        title: template.title,
        body: template.body,
        href: `/app/messages/${conversationId}`,
      },
    })
    .catch(() => undefined);

  return { ok: true, messageId: message.id, warning: scan.userWarning };
}

export async function loadConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      match: {
        include: {
          userA: { include: { profile: true, photos: true } },
          userB: { include: { profile: true, photos: true } },
        },
      },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });

  if (!conversation) return null;
  const { userAId, userBId } = conversation.match;
  if (userId !== userAId && userId !== userBId) return null;

  const other = userId === userAId ? conversation.match.userB : conversation.match.userA;

  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return { conversation, other };
}

export async function listConversations(userId: string) {
  const matches = await prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: "ACTIVE" },
    include: {
      conversation: {
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      userA: { include: { profile: true, photos: true } },
      userB: { include: { profile: true, photos: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return matches.map((match) => {
    const other = match.userAId === userId ? match.userB : match.userA;
    const lastMessage = match.conversation?.messages[0] ?? null;
    return {
      matchId: match.id,
      conversationId: match.conversation?.id ?? null,
      score: match.score,
      firstName: other.profile?.firstName ?? "Membre",
      photoUrl: other.photos.find((p) => p.isPrimary && p.moderationStatus === "APPROVED")?.storageKey ?? null,
      otherId: other.id,
      lastMessage: lastMessage?.body ?? null,
      lastMessageAt: lastMessage?.createdAt ?? null,
      unread: lastMessage !== null && lastMessage.senderId !== userId && lastMessage.readAt === null,
    };
  });
}
