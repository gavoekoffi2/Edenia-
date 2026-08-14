import { createHash, randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { getGeniusPayClient, redactSecrets } from "./geniuspay/client";
import type { GeniusPayWebhookPayload } from "./geniuspay/webhook";
import {
  decideTransition,
  grantsPremium,
  statusFromEvent,
  statusFromGateway,
  type PaymentStatus,
} from "./status";

/**
 * Orchestration des paiements EDENIA ↔ GeniusPay.
 *
 * Deux regles gouvernent tout ce fichier :
 *  §10 — le retour de l'utilisateur sur `success_url` ne confirme rien. Seul le
 *        backend, via webhook ou consultation directe, fait foi.
 *  §12 — le traitement des webhooks est idempotent. Deux livraisons du meme
 *        evenement ne peuvent pas creer deux abonnements.
 */

export const GATEWAY = env.PAYMENT_PROVIDER === "geniuspay" ? "GENIUSPAY" : "SIMULATED";
export const ENVIRONMENT = env.GENIUSPAY_ENVIRONMENT;

/** Reference interne, transmise en metadata et affichee au support. */
function newOrderRef(): string {
  return `EDN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/**
 * §14 : XOF n'a pas de subdivision — 1 « cent » de notre modele = 1 FCFA.
 * Pour EUR/USD, GeniusPay attend l'unite majeure : on divise par 100.
 */
export function toGatewayAmount(amountCents: number, currency: string): number {
  if (currency.toUpperCase() === "XOF" || currency.toUpperCase() === "XAF") return amountCents;
  return Math.round(amountCents) / 100;
}

export interface CreateCheckoutInput {
  userId: string;
  planCode: string;
}

export type CreateCheckoutResult =
  | { ok: true; paymentId: string; orderRef: string; checkoutUrl: string; simulated: boolean }
  | { ok: false; error: string; code?: string };

export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  const [plan, user] = await Promise.all([
    prisma.plan.findUnique({ where: { code: input.planCode } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        phone: true,
        email: true,
        profile: { select: { firstName: true, countryCode: true } },
      },
    }),
  ]);

  if (!plan?.isActive) return { ok: false, error: "Cette offre n'est pas disponible." };
  if (!user) return { ok: false, error: "Compte introuvable." };
  if (plan.priceCents <= 0) return { ok: false, error: "Cette offre est gratuite." };

  // §12 : une seule transaction ouverte a la fois par utilisateur et par offre.
  // Un double clic sur « Payer » ne doit pas creer deux commandes.
  const openPayment = await prisma.payment.findFirst({
    where: {
      userId: user.id,
      planCode: plan.code,
      status: { in: ["PENDING", "PROCESSING"] },
      createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (openPayment?.checkoutUrl) {
    return {
      ok: true,
      paymentId: openPayment.id,
      orderRef: openPayment.orderRef,
      checkoutUrl: openPayment.checkoutUrl,
      simulated: openPayment.gateway === "SIMULATED",
    };
  }

  const orderRef = newOrderRef();

  const subscription = await prisma.subscription.create({
    data: { userId: user.id, planCode: plan.code, status: "PENDING" },
  });

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      planCode: plan.code,
      gateway: GATEWAY,
      environment: ENVIRONMENT,
      orderRef,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: "PENDING",
      idempotencyKey: orderRef,
    },
  });

  await recordTransaction(payment.id, {
    source: "CREATED",
    toStatus: "PENDING",
    amountCents: plan.priceCents,
    currency: plan.currency,
  });

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // §9 : les metadata font le lien GeniusPay ↔ EDENIA. Jamais le montant seul.
  const metadata: Record<string, string> = {
    user_id: user.id,
    order_id: orderRef,
    subscription_id: subscription.id,
    plan: plan.code,
    environment: ENVIRONMENT,
  };

  if (GATEWAY === "SIMULATED") {
    // Mode test : page de checkout interne, clairement etiquetee. On ne fait
    // pas semblant d'appeler GeniusPay.
    const checkoutUrl = `${baseUrl}/paiement/simulation/${orderRef}`;
    await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl } });
    return { ok: true, paymentId: payment.id, orderRef, checkoutUrl, simulated: true };
  }

  const result = await getGeniusPayClient().createPayment({
    amount: toGatewayAmount(plan.priceCents, plan.currency),
    currency: plan.currency,
    description: `EDENIA ${plan.nameFr}`.slice(0, 500),
    customer: {
      name: user.profile?.firstName ?? undefined,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      country: user.profile?.countryCode ?? undefined,
    },
    successUrl: `${baseUrl}/paiement/succes?ref=${orderRef}`,
    errorUrl: `${baseUrl}/paiement/echec?ref=${orderRef}`,
    metadata,
    // payment_method volontairement absent : c'est ce qui donne la page de
    // checkout hebergee, ou le client choisit lui-meme (§8, §16, §17).
  });

  if (!result.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: result.message },
    });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED" } });
    await recordTransaction(payment.id, {
      source: "CREATED",
      fromStatus: "PENDING",
      toStatus: "FAILED",
      rawPayload: redactSecrets(JSON.stringify({ code: result.code, message: result.message })),
    });
    return { ok: false, error: result.message, code: result.code };
  }

  const checkoutUrl = result.data.checkoutUrl ?? result.data.paymentUrl;
  if (!checkoutUrl) {
    return { ok: false, error: "GeniusPay n'a pas renvoyé d'URL de paiement." };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerRef: result.data.reference,
      checkoutUrl,
      rawPayload: redactSecrets(JSON.stringify(result.data)),
    },
  });

  await audit({
    event: "PAYMENT_CHECKOUT_CREATED",
    actorType: "USER",
    actorRef: pseudonymize(user.id),
    metadata: { orderRef, providerRef: result.data.reference, plan: plan.code, environment: ENVIRONMENT },
  });

  return { ok: true, paymentId: payment.id, orderRef, checkoutUrl, simulated: false };
}

interface TransactionInput {
  source: string;
  event?: string;
  fromStatus?: string;
  toStatus: string;
  amountCents?: number;
  currency?: string;
  method?: string | null;
  providerRef?: string | null;
  deliveryId?: string | null;
  rawPayload?: string;
}

async function recordTransaction(paymentId: string, input: TransactionInput): Promise<void> {
  await prisma.paymentTransaction
    .create({
      data: {
        paymentId,
        source: input.source,
        event: input.event ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus,
        amountCents: input.amountCents ?? null,
        currency: input.currency ?? null,
        method: input.method ?? null,
        providerRef: input.providerRef ?? null,
        deliveryId: input.deliveryId ?? null,
        rawPayload: input.rawPayload ?? null,
      },
    })
    .catch(() => {
      // La contrainte (paymentId, deliveryId) peut rejeter un doublon : c'est
      // exactement le comportement voulu, pas une erreur a propager.
    });
}

export interface ApplyEventInput {
  event: string;
  deliveryId: string;
  environment: string;
  payload: GeniusPayWebhookPayload;
  rawBody: string;
}

export type ApplyEventResult =
  | { handled: true; status: PaymentStatus; paymentId: string; detail: string }
  | { handled: false; detail: string; duplicate?: boolean };

/**
 * Applique un evenement webhook, de facon idempotente (§12).
 *
 * L'idempotence repose sur une contrainte d'unicite en base, pas sur une
 * verification prealable : deux livraisons simultanees du meme evenement ne
 * peuvent donc pas passer toutes les deux.
 */
export async function applyWebhookEvent(input: ApplyEventInput): Promise<ApplyEventResult> {
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");

  try {
    await prisma.webhookEvent.create({
      data: {
        gateway: "GENIUSPAY",
        deliveryId: input.deliveryId,
        event: input.event,
        environment: input.environment,
        payloadHash,
        status: "PROCESSED",
      },
    });
  } catch {
    // Violation d'unicite : cet evenement a deja ete traite.
    return { handled: false, detail: "Événement déjà traité (idempotence).", duplicate: true };
  }

  if (input.event === "webhook.test") {
    return { handled: false, detail: "Webhook de test reçu et authentifié." };
  }

  const data = input.payload.data ?? {};
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  // §9 : on retrouve la commande par les metadata ou par la reference
  // GeniusPay — jamais par le montant, qui n'identifie rien.
  const orderRef = typeof metadata.order_id === "string" ? metadata.order_id : null;
  const providerRef = typeof data.reference === "string" ? data.reference : null;

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        ...(orderRef ? [{ orderRef }] : []),
        ...(providerRef ? [{ providerRef }] : []),
      ],
    },
    include: { subscription: true, plan: true },
  });

  if (!payment) {
    await markWebhook(input.deliveryId, "IGNORED", `Aucun paiement pour order_id=${orderRef ?? "?"} / ref=${providerRef ?? "?"}`);
    return { handled: false, detail: "Paiement introuvable pour cet événement." };
  }

  if (payment.environment !== input.environment) {
    await markWebhook(input.deliveryId, "IGNORED", "Environnement discordant.");
    return { handled: false, detail: "Environnement discordant : événement ignoré." };
  }

  const current = payment.status as PaymentStatus;
  const target = statusFromEvent(input.event) ?? statusFromGateway(data.status);

  if (!target) {
    await markWebhook(input.deliveryId, "IGNORED", `Événement non exploitable : ${input.event}`);
    return { handled: false, detail: `Événement ${input.event} sans statut exploitable.` };
  }

  const decision = decideTransition(current, target);

  await recordTransaction(payment.id, {
    source: "WEBHOOK",
    event: input.event,
    fromStatus: current,
    toStatus: decision.apply ? target : current,
    method: data.payment_method ?? data.provider ?? null,
    providerRef,
    deliveryId: input.deliveryId,
    rawPayload: redactSecrets(input.rawBody).slice(0, 8000),
  });

  if (!decision.apply) {
    await markWebhook(input.deliveryId, "IGNORED", decision.reason);
    return { handled: false, detail: decision.reason };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: target,
      method: data.payment_method ?? data.provider ?? payment.method,
      providerRef: providerRef ?? payment.providerRef,
      completedAt: target === "COMPLETED" ? new Date() : payment.completedAt,
      refundedAt: target === "REFUNDED" ? new Date() : payment.refundedAt,
      failureReason: target === "FAILED" ? "Paiement refusé par l'opérateur." : payment.failureReason,
    },
  });

  // §13 : Premium n'est accorde que sur un COMPLETED confirme par le backend.
  if (grantsPremium(target)) {
    await activateSubscription(payment.id);
  } else if (target === "REFUNDED" || target === "CANCELLED" || target === "EXPIRED" || target === "FAILED") {
    await deactivateSubscription(payment.id, target);
  }

  await audit({
    event: `PAYMENT_${target}`,
    actorType: "SYSTEM",
    actorRef: pseudonymize(payment.userId),
    metadata: { orderRef: payment.orderRef, event: input.event, environment: input.environment },
  });

  return { handled: true, status: target, paymentId: payment.id, detail: decision.reason };
}

async function markWebhook(deliveryId: string, status: string, detail: string): Promise<void> {
  await prisma.webhookEvent
    .updateMany({ where: { gateway: "GENIUSPAY", deliveryId }, data: { status, detail } })
    .catch(() => undefined);
}

/**
 * §14 : Premium repose sur un abonnement date, relie a un paiement — jamais sur
 * un simple booleen. L'historique financier doit rester reconstituable.
 */
export async function activateSubscription(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: true, plan: true },
  });
  if (!payment?.subscription || !payment.plan) return;
  if (payment.subscription.status === "ACTIVE") return; // deja actif : idempotent

  // Un renouvellement prolonge l'abonnement en cours plutot que de l'ecraser.
  const existingActive = await prisma.subscription.findFirst({
    where: {
      userId: payment.userId,
      status: "ACTIVE",
      endsAt: { gte: new Date() },
      id: { not: payment.subscription.id },
    },
    orderBy: { endsAt: "desc" },
  });

  const startsAt = existingActive?.endsAt ?? new Date();
  const endsAt = new Date(startsAt.getTime() + payment.plan.durationDays * 86_400_000);

  await prisma.subscription.update({
    where: { id: payment.subscription.id },
    data: { status: "ACTIVE", startsAt, endsAt },
  });

  await prisma.notification
    .create({
      data: {
        userId: payment.userId,
        kind: "SUBSCRIPTION",
        title: "EDENIA Premium activé ✦",
        body: `Votre abonnement est actif jusqu'au ${endsAt.toLocaleDateString("fr-FR")}.`,
        href: "/app/premium",
      },
    })
    .catch(() => undefined);
}

async function deactivateSubscription(paymentId: string, reason: PaymentStatus): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { subscription: true },
  });
  if (!payment?.subscription) return;

  await prisma.subscription.update({
    where: { id: payment.subscription.id },
    data: {
      status: reason === "REFUNDED" ? "CANCELLED" : "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: `Paiement ${reason}.`,
    },
  });

  if (reason === "REFUNDED") {
    await prisma.notification
      .create({
        data: {
          userId: payment.userId,
          kind: "SUBSCRIPTION",
          title: "Abonnement remboursé",
          body: "Votre abonnement Premium a été remboursé et désactivé.",
          href: "/app/premium",
        },
      })
      .catch(() => undefined);
  }
}

/**
 * §19 : consultation du statut reel aupres de GeniusPay. Utilisee au retour de
 * l'utilisateur, quand le webhook n'est pas encore arrive.
 */
export async function refreshPaymentStatus(orderRef: string): Promise<PaymentStatus | null> {
  const payment = await prisma.payment.findUnique({ where: { orderRef } });
  if (!payment) return null;
  if (payment.gateway !== "GENIUSPAY" || !payment.providerRef) return payment.status as PaymentStatus;

  const result = await getGeniusPayClient().getPayment(payment.providerRef);
  if (!result.ok) return payment.status as PaymentStatus;

  const target = statusFromGateway(result.data.status);
  if (!target) return payment.status as PaymentStatus;

  const current = payment.status as PaymentStatus;
  const decision = decideTransition(current, target);
  if (!decision.apply) return current;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: target,
      method: result.data.paymentMethod ?? payment.method,
      completedAt: target === "COMPLETED" ? new Date() : payment.completedAt,
    },
  });

  await recordTransaction(payment.id, {
    source: "STATUS_POLL",
    fromStatus: current,
    toStatus: target,
    method: result.data.paymentMethod,
    providerRef: payment.providerRef,
  });

  if (grantsPremium(target)) await activateSubscription(payment.id);

  return target;
}

/** Etat Premium reel d'un utilisateur, derive des abonnements. */
export async function premiumStatus(userId: string): Promise<{
  isPremium: boolean;
  endsAt: Date | null;
  planCode: string | null;
}> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gte: new Date() } },
    orderBy: { endsAt: "desc" },
  });
  return {
    isPremium: subscription !== null,
    endsAt: subscription?.endsAt ?? null,
    planCode: subscription?.planCode ?? null,
  };
}
