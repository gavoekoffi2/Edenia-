import { z } from "zod";
import { env } from "@/lib/config/env";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { applyWebhookEvent } from "@/lib/payments/service";
import { computeSignature } from "@/lib/payments/geniuspay/webhook";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";
import { randomUUID } from "node:crypto";

/**
 * Checkout simulé — mode développement uniquement.
 *
 * Cette route ne prend PAS de raccourci : elle fabrique un payload GeniusPay
 * authentique, le signe avec le secret local, puis le fait traverser exactement
 * le même code que la production (vérification de signature, contrôle
 * d'horodatage, idempotence, machine d'état). Un raccourci qui activerait
 * Premium directement laisserait le vrai chemin de paiement non testé — c'est
 * précisément le chemin qu'on ne peut pas se permettre de découvrir en ligne.
 */
const schema = z.object({
  orderRef: z.string().min(3),
  outcome: z.enum(["success", "failed", "cancelled", "expired", "refunded"]),
});

const EVENT_FOR: Record<string, string> = {
  success: "payment.success",
  failed: "payment.failed",
  cancelled: "payment.cancelled",
  expired: "payment.expired",
  refunded: "payment.refunded",
};

const STATUS_FOR: Record<string, string> = {
  success: "completed",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
  refunded: "refunded",
};

export const POST = handler(async (request) => {
  const user = await requireUser();

  if (env.PAYMENT_PROVIDER !== "simulated") {
    return fail("Le checkout simulé est désactivé : un agrégateur réel est configuré.", 403);
  }

  const body = await parseBody(request, schema);

  const payment = await prisma.payment.findUnique({
    where: { orderRef: body.orderRef },
    include: { plan: true },
  });
  if (!payment || payment.userId !== user.id) return fail("Commande introuvable.", 404);

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    id: randomUUID(),
    event: EVENT_FOR[body.outcome],
    timestamp,
    created_at: new Date().toISOString(),
    data: {
      object: "transaction",
      id: Math.floor(Math.random() * 100000),
      reference: payment.providerRef ?? `MTX-SIM-${payment.orderRef}`,
      amount: payment.amountCents,
      currency: payment.currency,
      fees: 0,
      net_amount: payment.amountCents,
      status: STATUS_FOR[body.outcome],
      payment_method: "mobile_money",
      provider: "simulation",
      metadata: {
        order_id: payment.orderRef,
        user_id: payment.userId,
        subscription_id: payment.subscriptionId,
        plan: payment.planCode,
        environment: payment.environment,
      },
    },
    environment: payment.environment,
    api_version: "2024-01-01",
  };

  const rawBody = JSON.stringify(payload);
  // Pas de secret en dur ici : on utilise celui de la configuration, exactement
  // comme la route webhook. Un secret code en dur, meme « de test », finit
  // toujours par se retrouver ailleurs.
  const secret = env.GENIUSPAY_WEBHOOK_SECRET;
  if (!secret) return fail("GENIUSPAY_WEBHOOK_SECRET absent : impossible de signer le webhook simulé.", 500);

  // On signe réellement, puis on passe par la vérification complète.
  const signature = computeSignature(String(timestamp), rawBody, secret);

  const { verifyWebhook } = await import("@/lib/payments/geniuspay/webhook");
  const verdict = verifyWebhook({
    rawBody,
    headers: {
      signature,
      timestamp: String(timestamp),
      event: payload.event ?? null,
      delivery: payload.id,
      environment: payment.environment,
    },
    secret,
    expectedEnvironment: payment.environment,
  });

  if (!verdict.ok) return fail(`Signature simulée invalide : ${verdict.reason}`, 500);

  const result = await applyWebhookEvent({
    event: verdict.event,
    deliveryId: verdict.deliveryId,
    environment: verdict.environment,
    payload: verdict.payload,
    rawBody,
  });

  return ok({ handled: result.handled, detail: result.detail, next: `/paiement/${body.outcome === "success" ? "succes" : "echec"}?ref=${payment.orderRef}` });
});
