/**
 * Machine d'etat des paiements (§13).
 *
 * Regle centrale : **un utilisateur ne devient Premium que sur un paiement
 * reellement confirme**. Le retour sur `success_url` ne prouve rien — il suffit
 * de connaitre l'URL pour l'atteindre.
 *
 * Les transitions sont explicites. Une transition non listee est refusee, ce
 * qui protege contre les webhooks desordonnes : GeniusPay peut livrer
 * `payment.success` puis, en retard, un `payment.initiated` du meme paiement.
 * Sans machine d'etat, ce simple retard ferait regresser un paiement encaisse.
 */

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Etats definitifs : plus aucune transition sortante, sauf remboursement. */
export const TERMINAL_STATUSES: readonly PaymentStatus[] = ["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"];

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"],
  // Un paiement encaisse ne peut que devenir rembourse.
  COMPLETED: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
  EXPIRED: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Seul cet etat ouvre le droit a Premium. */
export function grantsPremium(status: PaymentStatus): boolean {
  return status === "COMPLETED";
}

/** Statuts GeniusPay (minuscules) → statuts EDENIA. */
const FROM_GATEWAY: Record<string, PaymentStatus> = {
  pending: "PENDING",
  processing: "PROCESSING",
  completed: "COMPLETED",
  success: "COMPLETED",
  successful: "COMPLETED",
  failed: "FAILED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  refunded: "REFUNDED",
  expired: "EXPIRED",
};

export function statusFromGateway(raw: string | null | undefined): PaymentStatus | null {
  if (!raw) return null;
  return FROM_GATEWAY[raw.trim().toLowerCase()] ?? null;
}

/** Evenements webhook GeniusPay → statut cible. */
const FROM_EVENT: Record<string, PaymentStatus> = {
  "payment.initiated": "PENDING",
  "payment.success": "COMPLETED",
  "payment.failed": "FAILED",
  "payment.cancelled": "CANCELLED",
  "payment.refunded": "REFUNDED",
  "payment.expired": "EXPIRED",
};

export function statusFromEvent(event: string): PaymentStatus | null {
  return FROM_EVENT[event.trim().toLowerCase()] ?? null;
}

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "En attente de paiement",
  PROCESSING: "En cours de traitement",
  COMPLETED: "Payé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
  EXPIRED: "Expiré",
};

export interface TransitionDecision {
  apply: boolean;
  reason: string;
}

/**
 * Decide s'il faut appliquer une transition, en tenant compte du desordre de
 * livraison possible. Rend toujours un motif : c'est ce qui rend un litige de
 * paiement diagnosticable six mois plus tard.
 */
export function decideTransition(current: PaymentStatus, next: PaymentStatus): TransitionDecision {
  if (current === next) {
    return { apply: false, reason: `Déjà à l'état ${next} — événement en double, ignoré.` };
  }
  if (canTransition(current, next)) {
    return { apply: true, reason: `Transition ${current} → ${next}.` };
  }
  if (isTerminal(current)) {
    return { apply: false, reason: `État ${current} définitif : ${next} refusé (livraison tardive).` };
  }
  // Le cas le plus frequent en production : GeniusPay livre payment.success,
  // puis un payment.initiated retarde arrive. Le motif doit le dire clairement,
  // sinon le support cherchera un bug la ou il n'y en a pas.
  if (current === "COMPLETED") {
    return {
      apply: false,
      reason: `Paiement déjà encaissé (état ${current}, définitif hors remboursement) : ${next} refusé, livraison tardive ou désordonnée.`,
    };
  }
  return { apply: false, reason: `Transition ${current} → ${next} non autorisée.` };
}
