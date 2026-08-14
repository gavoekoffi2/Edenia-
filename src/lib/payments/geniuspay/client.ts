import { env } from "@/lib/config/env";

/**
 * Client HTTP GeniusPay (§5, §8).
 *
 * Base : https://geniuspay.ci/api/v1/merchant
 * Auth : X-API-Key + X-API-Secret, **exclusivement cote serveur**.
 *
 * Ce fichier est le seul a connaitre les cles. Rien de ce qu'il rend ne
 * contient de secret, et `redactError()` garantit qu'aucune cle ne peut se
 * retrouver dans un journal.
 */

export interface GeniusPayCustomer {
  name?: string;
  email?: string;
  /** Format international recommande : +228…, +225… */
  phone?: string;
  /** ISO2 — sert au routage PawaPay (§16). */
  country?: string;
}

export interface CreatePaymentInput {
  /** Montant en unites de la devise (XOF n'a pas de subdivision). Minimum 200. */
  amount: number;
  currency?: string;
  description?: string;
  customer?: GeniusPayCustomer;
  successUrl?: string;
  errorUrl?: string;
  metadata?: Record<string, string | number>;
  /**
   * §8 : volontairement omis pour obtenir la page de checkout hebergee.
   * Ne renseigner que pour cibler un moyen precis.
   */
  paymentMethod?: string;
  mmoProvider?: string;
}

export interface GeniusPayPayment {
  id: number | string;
  reference: string;
  amount: number;
  currency?: string;
  status: string;
  checkoutUrl: string | null;
  paymentUrl: string | null;
  paymentMethod: string | null;
  environment: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  fees?: number;
  netAmount?: number;
  completedAt?: string | null;
}

export type GeniusPayResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; httpStatus?: number };

/** Montant minimal impose par GeniusPay. */
export const MIN_AMOUNT_XOF = 200;

interface RawEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface RawPayment {
  id?: number | string;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  checkout_url?: string;
  payment_url?: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  environment?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  fees?: number;
  net_amount?: number;
  completed_at?: string | null;
}

export class GeniusPayClient {
  constructor(
    private readonly baseUrl = env.GENIUSPAY_BASE_URL,
    private readonly apiKey = env.GENIUSPAY_API_KEY,
    private readonly apiSecret = env.GENIUSPAY_API_SECRET,
    private readonly timeoutMs = env.GENIUSPAY_TIMEOUT_MS,
  ) {}

  get configured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  private headers(): Record<string, string> {
    return {
      "X-API-Key": this.apiKey ?? "",
      "X-API-Secret": this.apiSecret ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async call<T>(path: string, init: RequestInit): Promise<GeniusPayResult<T>> {
    if (!this.configured) {
      return { ok: false, code: "NOT_CONFIGURED", message: "GeniusPay n'est pas configuré." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(init.headers ?? {}) },
        signal: controller.signal,
        cache: "no-store",
      });

      const text = await response.text();
      let envelope: RawEnvelope<T>;
      try {
        envelope = JSON.parse(text) as RawEnvelope<T>;
      } catch {
        return {
          ok: false,
          code: "BAD_RESPONSE",
          message: `Réponse illisible de GeniusPay (HTTP ${response.status}).`,
          httpStatus: response.status,
        };
      }

      if (!response.ok || envelope.success === false || !envelope.data) {
        return {
          ok: false,
          code: envelope.error?.code ?? `HTTP_${response.status}`,
          message: envelope.error?.message ?? "Échec de la requête GeniusPay.",
          httpStatus: response.status,
        };
      }

      return { ok: true, data: envelope.data };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        message: aborted ? "GeniusPay n'a pas répondu à temps." : "GeniusPay est injoignable.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** §8 : creation d'un paiement en mode checkout heberge. */
  async createPayment(input: CreatePaymentInput): Promise<GeniusPayResult<GeniusPayPayment>> {
    if (input.amount < MIN_AMOUNT_XOF) {
      return {
        ok: false,
        code: "AMOUNT_TOO_LOW",
        message: `Le montant minimum accepté est de ${MIN_AMOUNT_XOF} FCFA.`,
      };
    }

    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency ?? "XOF",
    };

    if (input.description) body.description = input.description.slice(0, 500);
    if (input.successUrl) body.success_url = input.successUrl;
    if (input.errorUrl) body.error_url = input.errorUrl;
    if (input.metadata) body.metadata = input.metadata;
    // §8 : omettre payment_method est ce qui declenche la page de checkout.
    if (input.paymentMethod) body.payment_method = input.paymentMethod;
    if (input.mmoProvider) body.mmo_provider = input.mmoProvider;

    if (input.customer) {
      const customer: Record<string, string> = {};
      if (input.customer.name) customer.name = input.customer.name;
      if (input.customer.email) customer.email = input.customer.email;
      // §16 : le numero international permet a GeniusPay de router seul vers le
      // bon operateur. On ne reimplemente pas cette logique cote EDENIA.
      if (input.customer.phone) customer.phone = input.customer.phone;
      if (input.customer.country) customer.country = input.customer.country;
      if (Object.keys(customer).length > 0) body.customer = customer;
    }

    const result = await this.call<RawPayment>("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return result.ok ? { ok: true, data: normalize(result.data) } : result;
  }

  /**
   * §19 : source de verite du statut. Interrogee au retour de l'utilisateur,
   * car le passage par `success_url` ne prouve rien.
   */
  async getPayment(reference: string): Promise<GeniusPayResult<GeniusPayPayment>> {
    const result = await this.call<RawPayment>(`/payments/${encodeURIComponent(reference)}`, {
      method: "GET",
    });
    return result.ok ? { ok: true, data: normalize(result.data) } : result;
  }
}

function normalize(raw: RawPayment): GeniusPayPayment {
  return {
    id: raw.id ?? "",
    reference: raw.reference ?? "",
    amount: raw.amount ?? 0,
    currency: raw.currency ?? "XOF",
    status: (raw.status ?? "pending").toLowerCase(),
    checkoutUrl: raw.checkout_url ?? null,
    paymentUrl: raw.payment_url ?? null,
    paymentMethod: raw.payment_method ?? raw.payment_provider ?? null,
    environment: raw.environment ?? null,
    expiresAt: raw.expires_at ?? null,
    metadata: raw.metadata ?? {},
    fees: raw.fees,
    netAmount: raw.net_amount,
    completedAt: raw.completed_at ?? null,
  };
}

/**
 * §30 : retire toute trace de cle avant journalisation. Une cle dans un log
 * est une cle compromise — les logs sont copies, exportes et partages.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(pk|sk|whsec)_[A-Za-z0-9_-]{4,}/g, "$1_***redacted***")
    .replace(/("?(?:X-API-Secret|X-API-Key|api_secret|api_key)"?\s*[:=]\s*"?)[^"\s,}]+/gi, "$1***redacted***");
}

let cached: GeniusPayClient | null = null;

export function getGeniusPayClient(): GeniusPayClient {
  if (!cached) cached = new GeniusPayClient();
  return cached;
}

/** Pour les tests : injecter un client pointant vers un serveur factice. */
export function setGeniusPayClient(client: GeniusPayClient | null): void {
  cached = client;
}
