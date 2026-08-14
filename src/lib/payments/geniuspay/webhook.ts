import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification des webhooks GeniusPay (§10, §11).
 *
 * Contrat, tire de la documentation GeniusPay :
 *   signature = HMAC-SHA256(timestamp + "." + json_payload, secret)
 * en hexadecimal, avec le secret `whsec_...` propre a l'environnement.
 *
 * Ce module est **pur** : ni reseau, ni base. C'est ce qui permet de le tester
 * exhaustivement, y compris les cas d'attaque (rejeu, signature falsifiee,
 * secret de l'autre environnement).
 */

export const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes, comme la doc

export interface WebhookHeaders {
  signature: string | null;
  timestamp: string | null;
  event: string | null;
  delivery: string | null;
  environment: string | null;
}

export type WebhookFailure =
  | "MISSING_SIGNATURE"
  | "MISSING_TIMESTAMP"
  | "BAD_TIMESTAMP"
  | "TIMESTAMP_TOO_OLD"
  | "TIMESTAMP_IN_FUTURE"
  | "BAD_SIGNATURE"
  | "ENVIRONMENT_MISMATCH"
  | "INVALID_JSON"
  | "NO_SECRET";

export interface VerifiedWebhook {
  ok: true;
  payload: GeniusPayWebhookPayload;
  /** Identifiant de livraison, ou repli deterministe sur l'id du payload. */
  deliveryId: string;
  event: string;
  environment: string;
}

export interface RejectedWebhook {
  ok: false;
  reason: WebhookFailure;
  detail: string;
}

export interface GeniusPayWebhookPayload {
  id?: string;
  event?: string;
  timestamp?: number;
  created_at?: string;
  environment?: string;
  api_version?: string;
  data?: {
    object?: string;
    id?: number | string;
    reference?: string;
    amount?: number;
    currency?: string;
    fees?: number;
    net_amount?: number;
    status?: string;
    payment_method?: string | null;
    provider?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    merchant_id?: number;
    metadata?: Record<string, unknown>;
  };
}

/** Calcule la signature attendue. Exporte pour que les tests signent comme GeniusPay. */
export function computeSignature(timestamp: string, payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

/** Comparaison a temps constant, tolerante aux longueurs differentes. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface VerifyOptions {
  rawBody: string;
  headers: WebhookHeaders;
  secret: string | undefined;
  /** Environnement attendu : « sandbox » ou « live ». */
  expectedEnvironment: string;
  now?: number;
  toleranceSeconds?: number;
}

export function verifyWebhook(options: VerifyOptions): VerifiedWebhook | RejectedWebhook {
  const { rawBody, headers, secret, expectedEnvironment } = options;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS;

  if (!secret) {
    return { ok: false, reason: "NO_SECRET", detail: "GENIUSPAY_WEBHOOK_SECRET n'est pas configuré." };
  }
  if (!headers.signature) {
    return { ok: false, reason: "MISSING_SIGNATURE", detail: "En-tête X-Webhook-Signature absent." };
  }
  if (!headers.timestamp) {
    return { ok: false, reason: "MISSING_TIMESTAMP", detail: "En-tête X-Webhook-Timestamp absent." };
  }

  const timestamp = Number.parseInt(headers.timestamp, 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, reason: "BAD_TIMESTAMP", detail: "Horodatage illisible." };
  }

  // §11 : protection contre le rejeu. Une signature valide interceptee ne doit
  // pas pouvoir etre rejouee des heures plus tard.
  const drift = now - timestamp;
  if (drift > tolerance) {
    return { ok: false, reason: "TIMESTAMP_TOO_OLD", detail: `Webhook trop ancien (${drift} s).` };
  }
  // Une date dans le futur signale une horloge desynchronisee ou une tentative
  // de contourner la fenetre — on refuse dans les deux cas.
  if (drift < -tolerance) {
    return { ok: false, reason: "TIMESTAMP_IN_FUTURE", detail: "Horodatage dans le futur." };
  }

  /*
   * La documentation GeniusPay signe `json_encode($request->all())`, c'est-a-dire
   * une RE-serialisation du corps, pas le corps brut. Or PHP et JavaScript
   * n'encodent pas le JSON de facon identique (echappement des slashes, des
   * accents, notation des flottants). Se fier a une seule forme exposerait a des
   * rejets sporadiques et incomprehensibles en production.
   *
   * On accepte donc trois formes, toutes comparees a temps constant :
   *   1. le corps brut recu — le cas le plus courant et le plus sur ;
   *   2. une re-serialisation JavaScript ;
   *   3. une re-serialisation imitant json_encode() de PHP (slashes et unicode
   *      echappes), qui est ce que produit l'exemple de la documentation.
   *
   * Aucune de ces variantes n'affaiblit la verification : chacune exige la
   * connaissance du secret.
   */
  const candidates = signatureCandidates(headers.timestamp, rawBody, secret);
  const provided = headers.signature.trim().toLowerCase();
  const matches = candidates.some((candidate) => safeCompare(candidate, provided));

  if (!matches) {
    return { ok: false, reason: "BAD_SIGNATURE", detail: "Signature invalide." };
  }

  let payload: GeniusPayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GeniusPayWebhookPayload;
  } catch {
    return { ok: false, reason: "INVALID_JSON", detail: "Corps de requête illisible." };
  }

  // §7 : ne jamais melanger sandbox et production. Un webhook sandbox recu par
  // un serveur live creerait un abonnement sans paiement reel.
  const environment = (headers.environment ?? payload.environment ?? "").toLowerCase();
  if (environment && environment !== expectedEnvironment.toLowerCase()) {
    return {
      ok: false,
      reason: "ENVIRONMENT_MISMATCH",
      detail: `Webhook « ${environment} » reçu par un serveur « ${expectedEnvironment} ».`,
    };
  }

  const event = headers.event ?? payload.event ?? "unknown";

  // §12 : X-Webhook-Delivery est documente comme optionnel. Sans lui, on
  // retombe sur l'identifiant du payload, puis sur une empreinte du contenu —
  // il faut toujours une cle d'idempotence.
  const deliveryId =
    headers.delivery ??
    payload.id ??
    createHmac("sha256", secret).update(rawBody).digest("hex").slice(0, 40);

  return { ok: true, payload, deliveryId, event, environment: environment || expectedEnvironment };
}

function signatureCandidates(timestamp: string, rawBody: string, secret: string): string[] {
  const forms = new Set<string>([rawBody]);

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    forms.add(JSON.stringify(parsed));
    forms.add(phpJsonEncode(parsed));
  } catch {
    // Corps non-JSON : seule la forme brute est testee, et l'analyse echouera
    // ensuite de toute facon.
  }

  return [...forms].map((form) => computeSignature(timestamp, form, secret));
}

/**
 * Imite `json_encode()` de PHP sans option : les slashes sont echappes en `\/`
 * et les caracteres non-ASCII en `\uXXXX`.
 */
function phpJsonEncode(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\//g, "\\/")
    .replace(/[\u0080-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** Evenements que EDENIA sait traiter (§10). */
export const HANDLED_EVENTS = [
  "payment.initiated",
  "payment.success",
  "payment.failed",
  "payment.cancelled",
  "payment.refunded",
  "payment.expired",
  "webhook.test",
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(event: string): event is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(event);
}
