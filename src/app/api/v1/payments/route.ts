import { z } from "zod";
import { PAYMENT_PROVIDER } from "@/lib/config/enums";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { getPaymentProvider, idempotencyKeyFor } from "@/lib/payments/provider";
import { normalizePhone } from "@/lib/auth/otp";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  planCode: z.string().min(1),
  provider: z.enum(PAYMENT_PROVIDER),
  payerPhone: z.string().min(6).max(20),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  const [plan, profile] = await Promise.all([
    prisma.plan.findUnique({ where: { code: body.planCode } }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { countryCode: true } }),
  ]);

  if (!plan?.isActive) return fail("Cette offre n'est pas disponible.", 404);

  const phone = normalizePhone(body.payerPhone, profile?.countryCode ?? "TG");
  if (!phone) return fail("Ce numéro ne semble pas valide.", 400);

  // Idempotence : un double appui sur « Payer » ne débite jamais deux fois.
  const idempotencyKey = idempotencyKeyFor(user.id, plan.code);
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return ok({
      paymentId: existing.id,
      status: existing.status,
      message: "Un paiement est déjà en cours pour cette offre.",
    });
  }

  const subscription = await prisma.subscription.create({
    data: { userId: user.id, planCode: plan.code, status: "PENDING" },
  });

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      provider: body.provider,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: "INITIATED",
      idempotencyKey,
    },
  });

  const result = await getPaymentProvider().initiate({
    idempotencyKey,
    userId: user.id,
    amountCents: plan.priceCents,
    currency: plan.currency,
    planCode: plan.code,
    payerPhone: phone,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: result.status,
      providerRef: result.providerRef,
      failureReason: result.failureReason ?? null,
    },
  });

  if (result.status === "FAILED") {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED" } });
    return fail(result.failureReason ?? "Le paiement a échoué.", 402);
  }

  return ok({
    paymentId: payment.id,
    status: result.status,
    userInstruction: result.userInstruction,
    redirectUrl: result.redirectUrl,
  });
});
