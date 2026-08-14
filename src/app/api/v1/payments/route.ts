import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/ratelimit";
import { createCheckout } from "@/lib/payments/service";
import { premiumIsPublic } from "@/lib/config/monetization";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({ planCode: z.string().min(1).max(40) });

/**
 * §8 — création d'une transaction, puis redirection vers le checkout hébergé.
 *
 * EDENIA ne collecte aucune donnée de paiement : ni numéro de carte, ni CVV,
 * ni code Mobile Money (§17). Le moyen de paiement est choisi chez GeniusPay.
 */
export const POST = handler(async (request) => {
  // §1 : en lancement gratuit, aucun abonnement ne peut etre ouvert. Le
  // controle est ici, cote serveur, et pas seulement dans l'interface : cacher
  // un bouton n'a jamais empeche personne d'appeler l'API.
  if (!premiumIsPublic) {
    return fail("EDENIA est actuellement gratuite : aucun abonnement n'est proposé.", 403);
  }

  const user = await requireUser();
  const body = await parseBody(request, schema);

  const limit = await rateLimit(`pay:${user.id}`, 10, 3_600_000);
  if (!limit.allowed) return fail("Trop de tentatives de paiement. Réessayez plus tard.", 429);

  const result = await createCheckout({ userId: user.id, planCode: body.planCode });
  if (!result.ok) return fail(result.error, 402, { code: result.code });

  return ok({
    orderRef: result.orderRef,
    checkoutUrl: result.checkoutUrl,
    simulated: result.simulated,
  });
});
