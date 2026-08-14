import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createDonationCheckout, donationsOpen, MAX_DONATION_XOF, MIN_DONATION_XOF } from "@/lib/donations/service";
import { clientIp, fail, handler, ok, parseBody } from "@/lib/api/respond";
import { rateLimit } from "@/lib/auth/ratelimit";
import { hashIp } from "@/lib/crypto/field";

/**
 * §4 — ouverture d'un don.
 *
 * Volontairement accessible sans compte : soutenir la plateforme n'exige pas
 * d'y être inscrit. En contrepartie, la route est limitée par IP, sinon elle
 * deviendrait un moyen gratuit de créer des lignes en base.
 */
const schema = z.object({
  amountCents: z.number().int().min(MIN_DONATION_XOF).max(MAX_DONATION_XOF),
  donorName: z.string().trim().max(80).optional(),
  donorEmail: z.email().max(160).optional(),
  message: z.string().trim().max(500).optional(),
  isAnonymous: z.boolean().optional(),
});

export const POST = handler(async (request) => {
  if (!(await donationsOpen())) return fail("Les dons sont actuellement fermés.", 403);

  const ip = clientIp(request);
  const limit = await rateLimit(`don:${hashIp(ip) ?? "anon"}`, 10, 3_600_000);
  if (!limit.allowed) return fail("Trop de tentatives. Réessayez plus tard.", 429);

  const body = await parseBody(request, schema);
  const user = await getCurrentUser();

  const result = await createDonationCheckout({
    userId: user?.id ?? null,
    donorName: body.donorName ?? null,
    donorEmail: body.donorEmail ?? null,
    amountCents: body.amountCents,
    message: body.message ?? null,
    isAnonymous: body.isAnonymous ?? false,
  });

  if (!result.ok) return fail(result.error, 400);

  return ok({
    orderRef: result.orderRef,
    checkoutUrl: result.checkoutUrl,
    simulated: result.simulated,
  });
});
