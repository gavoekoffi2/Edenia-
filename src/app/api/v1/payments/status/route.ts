import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { premiumStatus, refreshPaymentStatus } from "@/lib/payments/service";
import { STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";
import { fail, handler, ok } from "@/lib/api/respond";

const querySchema = z.object({ ref: z.string().min(3).max(64) });

/**
 * §19 — statut réel d'un paiement.
 *
 * Appelée par la page de retour. Le fait que l'utilisateur soit arrivé sur
 * success_url ne prouve rien : on interroge GeniusPay, et c'est cette réponse
 * (ou le webhook déjà reçu) qui fait foi.
 */
export const GET = handler(async (request) => {
  const user = await requireUser();
  const parsed = querySchema.safeParse({ ref: new URL(request.url).searchParams.get("ref") ?? "" });
  if (!parsed.success) return fail("Référence de commande manquante.", 400);

  const payment = await prisma.payment.findUnique({
    where: { orderRef: parsed.data.ref },
    include: { plan: true },
  });

  // Pas d'énumération : une commande d'autrui répond comme une commande absente.
  if (!payment || payment.userId !== user.id) return fail("Commande introuvable.", 404);

  const status = (await refreshPaymentStatus(payment.orderRef)) ?? (payment.status as PaymentStatus);
  const premium = await premiumStatus(user.id);

  return ok({
    orderRef: payment.orderRef,
    status,
    label: STATUS_LABEL[status],
    amount: payment.amountCents,
    currency: payment.currency,
    planName: payment.plan?.nameFr ?? null,
    method: payment.method,
    isPremium: premium.isPremium,
    premiumEndsAt: premium.endsAt?.toISOString() ?? null,
  });
});
