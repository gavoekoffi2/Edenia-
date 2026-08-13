import { randomUUID } from "node:crypto";
import type { PaymentProviderCode } from "@/lib/config/enums";

/**
 * §42 — « Creer une couche abstraite de paiement afin d'ajouter facilement de
 * nouveaux prestataires. »
 *
 * Les agregateurs Mobile Money d'Afrique de l'Ouest partagent un meme schema :
 * on initie un paiement, l'utilisateur confirme sur son telephone (USSD ou
 * notification), puis un webhook confirme. L'interface reflete ce cycle plutot
 * que celui d'une carte bancaire.
 */

export interface PaymentIntent {
  /** Cle d'idempotence — un double appui sur « Payer » ne debite jamais deux fois. */
  idempotencyKey: string;
  userId: string;
  amountCents: number;
  currency: string;
  planCode: string;
  /** Numero payeur au format E.164, pour le Mobile Money. */
  payerPhone?: string;
  returnUrl?: string;
}

export type PaymentStatus = "INITIATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface PaymentResult {
  status: PaymentStatus;
  providerRef: string | null;
  /** Instruction a afficher : « Composez #145# pour confirmer », par exemple. */
  userInstruction?: string;
  /** Page hebergee du prestataire, quand il y en a une. */
  redirectUrl?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  providerRef?: string;
  status?: PaymentStatus;
  reason?: string;
}

export interface PaymentProvider {
  readonly code: PaymentProviderCode;
  readonly label: string;
  /** Pays ou ce moyen de paiement est disponible (ISO alpha-2). */
  readonly countries: readonly string[];
  readonly requiresPhone: boolean;

  initiate(intent: PaymentIntent): Promise<PaymentResult>;
  /** Consultation d'etat — les Mobile Money sont asynchrones. */
  checkStatus(providerRef: string): Promise<PaymentResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerification>;
}

/**
 * Prestataire de demonstration. Il rend le parcours d'abonnement complet
 * testable sans contrat commercial, et sert de reference d'implementation pour
 * les adaptateurs reels (T-Money, Flooz, MTN MoMo, Wave...).
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly code = "SIMULATED" as const;
  readonly label = "Paiement de démonstration";
  readonly countries = ["TG", "BJ", "CI", "CM", "SN", "CD", "BF", "GN", "GA", "ML", "NE"] as const;
  readonly requiresPhone = true;

  private readonly store = new Map<string, PaymentResult>();

  async initiate(intent: PaymentIntent): Promise<PaymentResult> {
    const providerRef = `sim_${randomUUID()}`;

    // Un numero se terminant par 0 echoue : permet de tester le chemin d'erreur.
    const willFail = intent.payerPhone?.endsWith("0") ?? false;

    const result: PaymentResult = willFail
      ? {
          status: "FAILED",
          providerRef,
          failureReason: "Solde insuffisant (simulation).",
        }
      : {
          status: "PENDING",
          providerRef,
          userInstruction:
            "Un message de confirmation vient d'être envoyé sur votre téléphone. " +
            "Validez-le pour activer votre abonnement.",
        };

    this.store.set(providerRef, result);
    return result;
  }

  async checkStatus(providerRef: string): Promise<PaymentResult> {
    const known = this.store.get(providerRef);
    if (!known) return { status: "FAILED", providerRef, failureReason: "Référence inconnue." };
    if (known.status === "PENDING") {
      const confirmed: PaymentResult = { ...known, status: "SUCCEEDED" };
      this.store.set(providerRef, confirmed);
      return confirmed;
    }
    return known;
  }

  async verifyWebhook(rawBody: string): Promise<WebhookVerification> {
    try {
      const payload = JSON.parse(rawBody) as { ref?: string; status?: PaymentStatus };
      if (!payload.ref) return { valid: false, reason: "Référence absente." };
      return { valid: true, providerRef: payload.ref, status: payload.status ?? "SUCCEEDED" };
    } catch {
      return { valid: false, reason: "Corps de requête illisible." };
    }
  }
}

/**
 * Catalogue des moyens de paiement par pays (§42). Les adaptateurs reels
 * viendront s'enregistrer ici sans toucher au code appelant.
 */
export interface PaymentMethodDescriptor {
  code: PaymentProviderCode;
  label: string;
  countries: readonly string[];
  logoHint: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodDescriptor[] = [
  { code: "TMONEY", label: "T-Money", countries: ["TG"], logoHint: "tmoney" },
  { code: "FLOOZ", label: "Flooz", countries: ["TG", "BJ"], logoHint: "flooz" },
  { code: "MTN_MOMO", label: "MTN Mobile Money", countries: ["CI", "CM", "BJ", "GN", "CD"], logoHint: "mtn" },
  { code: "MOOV_MONEY", label: "Moov Money", countries: ["CI", "BJ", "BF", "TG"], logoHint: "moov" },
  { code: "ORANGE_MONEY", label: "Orange Money", countries: ["CI", "CM", "SN", "ML", "BF", "GN", "CD"], logoHint: "orange" },
  { code: "WAVE", label: "Wave", countries: ["SN", "CI", "ML", "BF"], logoHint: "wave" },
  { code: "CARD", label: "Carte bancaire", countries: ["*"], logoHint: "card" },
];

export function methodsForCountry(countryCode: string): PaymentMethodDescriptor[] {
  return PAYMENT_METHODS.filter(
    (method) => method.countries.includes("*") || method.countries.includes(countryCode.toUpperCase()),
  );
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!cached) cached = new SimulatedPaymentProvider();
  return cached;
}

/** Cle d'idempotence stable : meme utilisateur + meme offre + meme minute. */
export function idempotencyKeyFor(userId: string, planCode: string, now = new Date()): string {
  const minute = Math.floor(now.getTime() / 60_000);
  return `${userId}:${planCode}:${minute}`;
}
