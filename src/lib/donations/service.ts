import { createHash, randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { donationsEnabled } from "@/lib/config/monetization";
import { getBooleanSetting } from "@/lib/settings/service";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { getGeniusPayClient, redactSecrets } from "@/lib/payments/geniuspay/client";
import type { GeniusPayWebhookPayload } from "@/lib/payments/geniuspay/webhook";
import { ENVIRONMENT, GATEWAY, toGatewayAmount } from "@/lib/payments/service";
import { decideTransition, statusFromEvent, statusFromGateway, type PaymentStatus } from "@/lib/payments/status";

/**
 * §4, §5 — le soutien volontaire.
 *
 * Ce module partage la machine d'etat et la verification de signature des
 * paiements, parce que la mecanique d'encaissement est la meme. Mais il ne
 * partage **aucun** effet : un don confirme ne cree pas d'abonnement, ne touche
 * pas au badge, ne modifie ni le matching ni la visibilite. La seule ecriture
 * declenchee par un don encaisse est le don lui-meme et un remerciement.
 *
 * Cette separation n'est pas qu'une convention de nommage : `Donation` et
 * `Subscription` sont deux tables sans lien, et rien dans ce fichier n'importe
 * `activateSubscription`.
 */

/*
 * Les paliers proposes (500, 1000, 2000...) vivent dans le formulaire, pas ici :
 * ce sont des reperes d'interface, pas une regle metier. Le serveur, lui,
 * n'impose que le plancher et le plafond — un montant libre reste valide.
 */
export const MIN_DONATION_XOF = 200;
export const MAX_DONATION_XOF = 2_000_000;

function newDonationRef(): string {
  return `DON-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/** Un `order_id` prefixe DON- identifie un don dans les webhooks (§4). */
export function isDonationRef(orderRef: string | null | undefined): boolean {
  return typeof orderRef === "string" && orderRef.startsWith("DON-");
}

export interface CreateDonationInput {
  userId?: string | null;
  donorName?: string | null;
  donorEmail?: string | null;
  amountCents: number;
  currency?: string;
  message?: string | null;
  isAnonymous?: boolean;
}

export type CreateDonationResult =
  | { ok: true; donationId: string; orderRef: string; checkoutUrl: string; simulated: boolean }
  | { ok: false; error: string };

/**
 * Les dons sont ouverts si l'environnement les autorise **et** si le
 * back-office ne les a pas suspendus. L'interrupteur d'exploitation ne peut
 * qu'aller dans le sens de la fermeture : une variable d'environnement a
 * `false` ne se contourne pas depuis une interface web.
 */
export async function donationsOpen(): Promise<boolean> {
  if (!donationsEnabled) return false;
  return getBooleanSetting("support.donations_open");
}

export async function createDonationCheckout(input: CreateDonationInput): Promise<CreateDonationResult> {
  if (!(await donationsOpen())) return { ok: false, error: "Les dons sont actuellement fermés." };

  const currency = (input.currency ?? "XOF").toUpperCase();
  const amount = Math.round(input.amountCents);

  if (!Number.isFinite(amount) || amount < MIN_DONATION_XOF) {
    return { ok: false, error: `Le montant minimum est de ${MIN_DONATION_XOF} FCFA.` };
  }
  if (amount > MAX_DONATION_XOF) {
    return { ok: false, error: "Ce montant dépasse la limite autorisée en ligne. Contactez-nous." };
  }

  const orderRef = newDonationRef();

  const donation = await prisma.donation.create({
    data: {
      userId: input.userId ?? null,
      donorName: input.donorName?.trim() || null,
      donorEmail: input.donorEmail?.trim() || null,
      amountCents: amount,
      currency,
      message: input.message?.trim().slice(0, 500) || null,
      isAnonymous: input.isAnonymous ?? false,
      status: "PENDING",
      gateway: GATEWAY,
      environment: ENVIRONMENT,
      orderRef,
    },
  });

  await recordDonationTransaction(donation.id, { source: "CREATED", toStatus: "PENDING" });

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  if (GATEWAY === "SIMULATED") {
    const checkoutUrl = `${baseUrl}/paiement/simulation/${orderRef}`;
    await prisma.donation.update({ where: { id: donation.id }, data: { checkoutUrl } });
    return { ok: true, donationId: donation.id, orderRef, checkoutUrl, simulated: true };
  }

  const result = await getGeniusPayClient().createPayment({
    amount: toGatewayAmount(amount, currency),
    currency,
    description: "Soutien à EDENIA",
    customer: {
      name: input.donorName ?? undefined,
      email: input.donorEmail ?? undefined,
    },
    successUrl: `${baseUrl}/soutenir/merci?ref=${orderRef}`,
    errorUrl: `${baseUrl}/soutenir?echec=1&ref=${orderRef}`,
    metadata: {
      kind: "donation",
      order_id: orderRef,
      donation_id: donation.id,
      environment: ENVIRONMENT,
      ...(input.userId ? { user_id: input.userId } : {}),
    },
  });

  if (!result.ok) {
    await prisma.donation.update({ where: { id: donation.id }, data: { status: "FAILED" } });
    await recordDonationTransaction(donation.id, {
      source: "CREATED",
      fromStatus: "PENDING",
      toStatus: "FAILED",
      rawPayload: redactSecrets(JSON.stringify({ code: result.code, message: result.message })),
    });
    return { ok: false, error: result.message };
  }

  const checkoutUrl = result.data.checkoutUrl ?? result.data.paymentUrl;
  if (!checkoutUrl) return { ok: false, error: "L'agrégateur n'a pas renvoyé d'URL de paiement." };

  await prisma.donation.update({
    where: { id: donation.id },
    data: { providerRef: result.data.reference, checkoutUrl },
  });

  return { ok: true, donationId: donation.id, orderRef, checkoutUrl, simulated: false };
}

interface DonationTransactionInput {
  source: string;
  event?: string;
  fromStatus?: string;
  toStatus: string;
  deliveryId?: string | null;
  rawPayload?: string;
}

async function recordDonationTransaction(donationId: string, input: DonationTransactionInput): Promise<void> {
  await prisma.donationTransaction
    .create({
      data: {
        donationId,
        source: input.source,
        event: input.event ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus,
        deliveryId: input.deliveryId ?? null,
        rawPayload: input.rawPayload ?? null,
      },
    })
    .catch(() => {
      // Contrainte (donationId, deliveryId) : un doublon est le comportement attendu.
    });
}

export interface ApplyDonationEventInput {
  event: string;
  deliveryId: string;
  environment: string;
  payload: GeniusPayWebhookPayload;
  rawBody: string;
}

export type ApplyDonationEventResult =
  | { handled: true; status: PaymentStatus; donationId: string; detail: string }
  | { handled: false; detail: string; duplicate?: boolean };

/**
 * Meme discipline que pour les paiements : idempotence par contrainte
 * d'unicite, machine d'etat, environnement verifie.
 */
export async function applyDonationWebhookEvent(input: ApplyDonationEventInput): Promise<ApplyDonationEventResult> {
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
    return { handled: false, detail: "Événement déjà traité (idempotence).", duplicate: true };
  }

  const data = input.payload.data ?? {};
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const orderRef = typeof metadata.order_id === "string" ? metadata.order_id : null;
  const providerRef = typeof data.reference === "string" ? data.reference : null;

  const donation = await prisma.donation.findFirst({
    where: { OR: [...(orderRef ? [{ orderRef }] : []), ...(providerRef ? [{ providerRef }] : [])] },
  });

  if (!donation) return { handled: false, detail: "Don introuvable pour cet événement." };
  if (donation.environment !== input.environment) {
    return { handled: false, detail: "Environnement discordant : événement ignoré." };
  }

  const current = donation.status as PaymentStatus;
  const target = statusFromEvent(input.event) ?? statusFromGateway(data.status);
  if (!target) return { handled: false, detail: `Événement ${input.event} sans statut exploitable.` };

  const decision = decideTransition(current, target);

  await recordDonationTransaction(donation.id, {
    source: "WEBHOOK",
    event: input.event,
    fromStatus: current,
    toStatus: decision.apply ? target : current,
    deliveryId: input.deliveryId,
    rawPayload: redactSecrets(input.rawBody).slice(0, 4000),
  });

  if (!decision.apply) return { handled: false, detail: decision.reason };

  await prisma.donation.update({
    where: { id: donation.id },
    data: {
      status: target,
      providerRef: providerRef ?? donation.providerRef,
      completedAt: target === "COMPLETED" ? new Date() : donation.completedAt,
    },
  });

  // §5 : voici TOUT ce qu'un don encaisse declenche. Un remerciement.
  // Aucun droit, aucun badge, aucun changement de visibilite ni de matching.
  if (target === "COMPLETED" && donation.userId) {
    await prisma.notification
      .create({
        data: {
          userId: donation.userId,
          kind: "SUPPORT",
          title: "Merci pour votre soutien ❤️",
          body: "Votre don aide EDENIA à rester gratuite pour tous. Il ne change rien à votre compte : vous aviez déjà tout.",
          href: "/soutenir/merci",
        },
      })
      .catch(() => undefined);
  }

  await audit({
    event: `DONATION_${target}`,
    actorType: "SYSTEM",
    actorRef: donation.userId ? pseudonymize(donation.userId) : "anonymous",
    metadata: { orderRef: donation.orderRef, event: input.event, environment: input.environment },
  });

  return { handled: true, status: target, donationId: donation.id, detail: decision.reason };
}

/** Totaux pour le back-office (§22). Aucune donnee nominative n'en sort. */
export async function donationSummary() {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [completed, pending, failed, total30, allTime, donorCount] = await Promise.all([
    prisma.donation.count({ where: { status: "COMPLETED" } }),
    prisma.donation.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.donation.count({ where: { status: { in: ["FAILED", "CANCELLED", "EXPIRED"] } } }),
    prisma.donation.aggregate({
      _sum: { amountCents: true },
      where: { status: "COMPLETED", completedAt: { gte: since30 } },
    }),
    prisma.donation.aggregate({ _sum: { amountCents: true }, where: { status: "COMPLETED" } }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return {
    completed,
    pending,
    failed,
    amount30: total30._sum.amountCents ?? 0,
    amountTotal: allTime._sum.amountCents ?? 0,
    distinctDonors: donorCount.length,
  };
}
