import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { applyDonationWebhookEvent } from "@/lib/donations/service";
import { computeSignature, verifyWebhook } from "@/lib/payments/geniuspay/webhook";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

/**
 * Don simulé — mode développement uniquement.
 *
 * Comme pour les abonnements, aucun raccourci : on fabrique un payload, on le
 * signe avec le secret local, et on le fait traverser la vérification complète.
 * Le chemin exercé est celui de la production.
 */
const schema = z.object({
  orderRef: z.string().min(3),
  outcome: z.enum(["success", "failed", "cancelled", "expired"]),
});

const EVENT_FOR: Record<string, string> = {
  success: "payment.success",
  failed: "payment.failed",
  cancelled: "payment.cancelled",
  expired: "payment.expired",
};

const STATUS_FOR: Record<string, string> = {
  success: "completed",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
};

export const POST = handler(async (request) => {
  if (env.PAYMENT_PROVIDER !== "simulated") {
    return fail("Le don simulé est désactivé : un agrégateur réel est configuré.", 403);
  }

  const body = await parseBody(request, schema);
  const donation = await prisma.donation.findUnique({ where: { orderRef: body.orderRef } });
  if (!donation) return fail("Don introuvable.", 404);

  // Un don rattaché à un compte ne peut être simulé que par ce compte.
  if (donation.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== donation.userId) return fail("Don introuvable.", 404);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    id: randomUUID(),
    event: EVENT_FOR[body.outcome],
    timestamp,
    created_at: new Date().toISOString(),
    data: {
      object: "transaction",
      reference: donation.providerRef ?? `MTX-SIM-${donation.orderRef}`,
      amount: donation.amountCents,
      currency: donation.currency,
      status: STATUS_FOR[body.outcome],
      payment_method: "mobile_money",
      provider: "simulation",
      metadata: {
        kind: "donation",
        order_id: donation.orderRef,
        donation_id: donation.id,
        environment: donation.environment,
      },
    },
    environment: donation.environment,
    api_version: "2024-01-01",
  };

  const rawBody = JSON.stringify(payload);
  const secret = env.GENIUSPAY_WEBHOOK_SECRET;
  if (!secret) return fail("GENIUSPAY_WEBHOOK_SECRET absent : impossible de signer le webhook simulé.", 500);

  const signature = computeSignature(String(timestamp), rawBody, secret);
  const verdict = verifyWebhook({
    rawBody,
    headers: {
      signature,
      timestamp: String(timestamp),
      event: payload.event ?? null,
      delivery: payload.id,
      environment: donation.environment,
    },
    secret,
    expectedEnvironment: donation.environment,
  });

  if (!verdict.ok) return fail(`Signature simulée invalide : ${verdict.reason}`, 500);

  const result = await applyDonationWebhookEvent({
    event: verdict.event,
    deliveryId: verdict.deliveryId,
    environment: verdict.environment,
    payload: verdict.payload,
    rawBody,
  });

  return ok({
    handled: result.handled,
    detail: result.detail,
    next: body.outcome === "success" ? `/soutenir/merci?ref=${donation.orderRef}` : `/soutenir?echec=1`,
  });
});
