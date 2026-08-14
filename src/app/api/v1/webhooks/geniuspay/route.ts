import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { applyWebhookEvent } from "@/lib/payments/service";
import { applyDonationWebhookEvent, isDonationRef } from "@/lib/donations/service";
import { redactSecrets } from "@/lib/payments/geniuspay/client";
import { verifyWebhook } from "@/lib/payments/geniuspay/webhook";

/**
 * Réception des webhooks GeniusPay (§10, §11, §12).
 *
 * Cette route est publique par nécessité — GeniusPay doit pouvoir l'appeler.
 * Sa seule protection est donc la signature HMAC : aucun traitement n'a lieu
 * avant qu'elle ne soit vérifiée.
 *
 * Le corps est lu en TEXTE BRUT, jamais via request.json() : la signature porte
 * sur les octets reçus, et un aller-retour de parsing les modifierait.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const verdict = verifyWebhook({
    rawBody,
    headers: {
      signature: request.headers.get("x-webhook-signature"),
      timestamp: request.headers.get("x-webhook-timestamp"),
      event: request.headers.get("x-webhook-event"),
      delivery: request.headers.get("x-webhook-delivery"),
      environment: request.headers.get("x-webhook-environment"),
    },
    secret: env.GENIUSPAY_WEBHOOK_SECRET,
    expectedEnvironment: env.GENIUSPAY_ENVIRONMENT,
  });

  if (!verdict.ok) {
    // Une tentative non authentifiée est un événement de sécurité : on la
    // journalise, sans jamais révéler à l'appelant ce qui a échoué.
    console.warn(`[webhook geniuspay] rejeté : ${verdict.reason} — ${redactSecrets(verdict.detail)}`);
    await prisma.auditLog
      .create({
        data: {
          event: "WEBHOOK_REJECTED",
          actorType: "SYSTEM",
          actorRef: "geniuspay",
          metadata: JSON.stringify({ reason: verdict.reason }),
        },
      })
      .catch(() => undefined);

    const status = verdict.reason === "TIMESTAMP_TOO_OLD" || verdict.reason === "TIMESTAMP_IN_FUTURE" ? 400 : 401;
    return Response.json({ status, detail: "Invalid signature" }, { status });
  }

  try {
    // Un don et un abonnement empruntent le meme tuyau chez l'agregateur, mais
    // n'ont aucun effet commun chez nous (§5). L'aiguillage se fait sur la
    // reference de commande, deja signee : elle n'est donc pas falsifiable.
    const metadata = (verdict.payload.data?.metadata ?? {}) as Record<string, unknown>;
    const orderRef = typeof metadata.order_id === "string" ? metadata.order_id : null;

    const result = isDonationRef(orderRef)
      ? await applyDonationWebhookEvent({
          event: verdict.event,
          deliveryId: verdict.deliveryId,
          environment: verdict.environment,
          payload: verdict.payload,
          rawBody,
        })
      : await applyWebhookEvent({
          event: verdict.event,
          deliveryId: verdict.deliveryId,
          environment: verdict.environment,
          payload: verdict.payload,
          rawBody,
        });

    // Toujours 200 sur un webhook authentifié, même si l'événement n'était pas
    // exploitable : un 4xx ferait re-tenter GeniusPay sans fin pour un
    // événement que nous avons délibérément ignoré.
    return Response.json({ received: true, handled: result.handled, detail: result.detail });
  } catch (error) {
    // En revanche, une erreur interne mérite une nouvelle tentative.
    console.error("[webhook geniuspay] erreur de traitement", redactSecrets(String(error)));
    return Response.json({ received: false, detail: "Erreur interne" }, { status: 500 });
  }
}

/** GeniusPay peut sonder l'URL avant de l'enregistrer. */
export async function GET(): Promise<Response> {
  return Response.json({ ok: true, endpoint: "geniuspay-webhook" });
}
