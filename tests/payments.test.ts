import { describe, expect, it } from "vitest";
import { computeSignature, isHandledEvent, verifyWebhook, WEBHOOK_TOLERANCE_SECONDS } from "@/lib/payments/geniuspay/webhook";
import { MIN_AMOUNT_XOF, redactSecrets } from "@/lib/payments/geniuspay/client";
import {
  PAYMENT_STATUSES,
  canTransition,
  decideTransition,
  grantsPremium,
  isTerminal,
  statusFromEvent,
  statusFromGateway,
} from "@/lib/payments/status";
import { toGatewayAmount } from "@/lib/payments/service";

const SECRET = "whsec_sandbox_test_secret_value";
const OTHER_SECRET = "whsec_live_un_autre_secret";

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    event: "payment.success",
    timestamp: 1_735_587_600,
    created_at: "2025-12-30T12:00:00.000000Z",
    data: {
      object: "transaction",
      id: 12345,
      reference: "MTX-A1B2C3D4E5",
      amount: 2000,
      currency: "XOF",
      status: "completed",
      payment_method: "mobile_money",
      provider: "wave",
      metadata: { order_id: "EDN-TEST-01", user_id: "u1" },
    },
    environment: "sandbox",
    api_version: "2024-01-01",
    ...overrides,
  };
}

/** Signe comme le ferait GeniusPay : HMAC-SHA256(timestamp + "." + payload). */
function sign(body: string, timestamp: number, secret = SECRET) {
  return computeSignature(String(timestamp), body, secret);
}

function headersFor(body: string, timestamp: number, overrides: Partial<Record<string, string | null>> = {}) {
  return {
    signature: sign(body, timestamp),
    timestamp: String(timestamp),
    event: "payment.success",
    delivery: "dlv_001",
    environment: "sandbox",
    ...overrides,
  };
}

describe("signature des webhooks GeniusPay (§11)", () => {
  const now = 1_735_587_600;

  it("accepte une signature valide sur le corps brut", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event).toBe("payment.success");
      expect(result.deliveryId).toBe("dlv_001");
    }
  });

  it("accepte aussi la forme json_encode() de PHP, comme dans la doc", () => {
    // PHP échappe les slashes et l'unicode ; JavaScript non. Si l'on ne
    // tolérait qu'une seule forme, les webhooks contenant une URL ou un accent
    // seraient rejetés au hasard en production.
    const payload = makePayload({ data: { ...makePayload().data, customer_name: "Amadou Diallo", note: "https://x.io/a" } });
    const body = JSON.stringify(payload);
    const phpForm = body.replace(/\//g, "\\/");

    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { signature: sign(phpForm, now) }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("refuse une signature falsifiée", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { signature: "0".repeat(64) }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("BAD_SIGNATURE");
  });

  it("refuse une signature produite avec le secret de l'autre environnement", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { signature: sign(body, now, OTHER_SECRET) }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("BAD_SIGNATURE");
  });

  it("refuse un corps modifié après signature", () => {
    const body = JSON.stringify(makePayload());
    const signature = sign(body, now);
    // Un attaquant intercepte et gonfle le montant.
    const tampered = body.replace('"amount":2000', '"amount":1');
    const result = verifyWebhook({
      rawBody: tampered,
      headers: headersFor(body, now, { signature }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un webhook rejoué au-delà de la fenêtre de 5 minutes (§11)", () => {
    const old = now - WEBHOOK_TOLERANCE_SECONDS - 1;
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, old),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("TIMESTAMP_TOO_OLD");
  });

  it("accepte un webhook juste dans la fenêtre", () => {
    const recent = now - WEBHOOK_TOLERANCE_SECONDS + 5;
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, recent),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("refuse un horodatage dans le futur", () => {
    const future = now + WEBHOOK_TOLERANCE_SECONDS + 60;
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, future),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("TIMESTAMP_IN_FUTURE");
  });

  it("refuse un webhook sandbox reçu par un serveur live (§7)", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now),
      secret: SECRET,
      expectedEnvironment: "live",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ENVIRONMENT_MISMATCH");
  });

  it("refuse tout traitement sans secret configuré", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now),
      secret: undefined,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_SECRET");
  });

  it("refuse les en-têtes manquants", () => {
    const body = JSON.stringify(makePayload());
    const noSig = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { signature: null }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    const noTs = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { timestamp: null }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(noSig.ok).toBe(false);
    expect(noTs.ok).toBe(false);
  });

  it("fournit une clé d'idempotence même sans en-tête X-Webhook-Delivery (§12)", () => {
    const body = JSON.stringify(makePayload());
    const result = verifyWebhook({
      rawBody: body,
      headers: headersFor(body, now, { delivery: null }),
      secret: SECRET,
      expectedEnvironment: "sandbox",
      now,
    });
    expect(result.ok).toBe(true);
    // Repli sur l'identifiant du payload.
    if (result.ok) expect(result.deliveryId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("reconnaît les événements documentés", () => {
    for (const event of [
      "payment.initiated",
      "payment.success",
      "payment.failed",
      "payment.cancelled",
      "payment.refunded",
      "payment.expired",
    ]) {
      expect(isHandledEvent(event), event).toBe(true);
    }
    expect(isHandledEvent("cashout.completed")).toBe(false);
  });
});

describe("machine d'état des paiements (§13)", () => {
  it("n'accorde Premium que sur COMPLETED", () => {
    for (const status of PAYMENT_STATUSES) {
      expect(grantsPremium(status)).toBe(status === "COMPLETED");
    }
  });

  it("autorise le cycle de vie normal", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "COMPLETED")).toBe(true);
    expect(canTransition("PENDING", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "REFUNDED")).toBe(true);
  });

  it("interdit de revenir en arrière depuis un état définitif", () => {
    // Cas réel : GeniusPay livre payment.success, puis un payment.initiated
    // retardé arrive. Sans machine d'état, le paiement encaissé régresserait.
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canTransition("COMPLETED", "FAILED")).toBe(false);
    expect(canTransition("REFUNDED", "COMPLETED")).toBe(false);
    expect(canTransition("FAILED", "COMPLETED")).toBe(false);
    expect(canTransition("EXPIRED", "COMPLETED")).toBe(false);
  });

  it("motive chaque refus, pour rendre un litige diagnosticable", () => {
    const late = decideTransition("COMPLETED", "PENDING");
    expect(late.apply).toBe(false);
    expect(late.reason).toContain("définitif");

    const duplicate = decideTransition("COMPLETED", "COMPLETED");
    expect(duplicate.apply).toBe(false);
    expect(duplicate.reason).toContain("double");

    const normal = decideTransition("PENDING", "COMPLETED");
    expect(normal.apply).toBe(true);
  });

  it("identifie correctement les états définitifs", () => {
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("EXPIRED")).toBe(true);
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
    expect(isTerminal("COMPLETED")).toBe(false); // peut encore être remboursé
  });

  it("traduit les statuts GeniusPay", () => {
    expect(statusFromGateway("pending")).toBe("PENDING");
    expect(statusFromGateway("processing")).toBe("PROCESSING");
    expect(statusFromGateway("completed")).toBe("COMPLETED");
    expect(statusFromGateway("failed")).toBe("FAILED");
    expect(statusFromGateway("expired")).toBe("EXPIRED");
    expect(statusFromGateway("refunded")).toBe("REFUNDED");
    expect(statusFromGateway("inconnu")).toBeNull();
    expect(statusFromGateway(null)).toBeNull();
  });

  it("traduit les événements webhook", () => {
    expect(statusFromEvent("payment.success")).toBe("COMPLETED");
    expect(statusFromEvent("payment.failed")).toBe("FAILED");
    expect(statusFromEvent("payment.refunded")).toBe("REFUNDED");
    expect(statusFromEvent("payment.expired")).toBe("EXPIRED");
    expect(statusFromEvent("cashout.completed")).toBeNull();
  });
});

describe("montants et secrets", () => {
  it("n'applique aucune division sur les devises sans subdivision", () => {
    // XOF/XAF n'ont pas de centimes : 2000 « cents » = 2 000 FCFA.
    expect(toGatewayAmount(2000, "XOF")).toBe(2000);
    expect(toGatewayAmount(15000, "XAF")).toBe(15000);
    // EUR/USD : GeniusPay attend l'unité majeure.
    expect(toGatewayAmount(2000, "EUR")).toBe(20);
  });

  it("respecte le montant minimum de GeniusPay", () => {
    expect(MIN_AMOUNT_XOF).toBe(200);
    // Toutes nos offres payantes doivent le dépasser.
    expect(toGatewayAmount(2000, "XOF")).toBeGreaterThanOrEqual(MIN_AMOUNT_XOF);
  });

  it("masque toute clé avant journalisation (§30)", () => {
    const leaky =
      'Erreur {"X-API-Secret":"sk_live_abcdef123456","X-API-Key":"pk_live_zzz999888"} secret whsec_live_qqqwwweee';
    const safe = redactSecrets(leaky);

    expect(safe).not.toContain("sk_live_abcdef123456");
    expect(safe).not.toContain("pk_live_zzz999888");
    expect(safe).not.toContain("whsec_live_qqqwwweee");
    expect(safe).toContain("redacted");
  });
});
