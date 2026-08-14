import { z } from "zod";

/**
 * Configuration validee au demarrage (docs/01-architecture.md §7).
 * En production, l'application refuse de demarrer si un secret manque —
 * mieux vaut un echec bruyant qu'un service qui tourne sans chiffrement.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(16),

  /**
   * Mode d'authentification (voir src/lib/config/mode.ts).
   * - development : code OTP fixe et affiche, aucun SMS envoye. Tous les
   *   controles (hachage, tentatives, expiration, limitation) restent actifs.
   * - production  : code aleatoire envoye par la passerelle SMS.
   * Par defaut : development hors production, production sinon.
   */
  AUTH_MODE: z.enum(["development", "production"]).optional(),

  AI_PROVIDER: z.enum(["rulebased", "anthropic"]).default("rulebased"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  AI_MAX_TURNS: z.coerce.number().int().min(3).max(30).default(12),

  SMS_PROVIDER: z.string().default("console"),
  EMAIL_PROVIDER: z.string().default("console"),
  SMS_SENDER_ID: z.string().default("EDENIA"),

  PAYMENT_PROVIDER: z.enum(["simulated", "geniuspay"]).default("simulated"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  /**
   * Modele economique actif.
   * - free      : lancement gratuit. Premium invisible pour les utilisateurs,
   *               le code reste en place. Les dons sont ouverts.
   * - donations : identique a « free » ; alias explicite.
   * - premium   : abonnements payants actifs.
   * Le defaut est « free » : un oubli de configuration ne peut pas facturer
   * quelqu'un par accident.
   */
  MONETIZATION_MODE: z.enum(["free", "donations", "premium"]).default("free"),
  /** Permet de couper les dons sans redeploiement de code. */
  DONATIONS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  // --- GeniusPay (§5-§7 de la phase d'integration) -------------------------
  // Les cles ne vivent QUE ici, cote serveur. Aucune n'est prefixee
  // NEXT_PUBLIC_, donc aucune ne peut traverser vers le navigateur.
  GENIUSPAY_BASE_URL: z.string().default("https://geniuspay.ci/api/v1/merchant"),
  /** sandbox | live — jamais melanges (§7). */
  GENIUSPAY_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  GENIUSPAY_API_KEY: z.string().optional(),
  GENIUSPAY_API_SECRET: z.string().optional(),
  /** Secret de signature des webhooks (whsec_...), distinct des cles API. */
  GENIUSPAY_WEBHOOK_SECRET: z.string().optional(),
  GENIUSPAY_TIMEOUT_MS: z.coerce.number().int().min(3000).max(60000).default(20000),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  NEXT_PUBLIC_APP_NAME: z.string().default("EDENIA"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

const DEV_FALLBACKS = {
  SESSION_SECRET: "dev-only-secret-change-in-production-0123456789abcdef",
  FIELD_ENCRYPTION_KEY: "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctZm9yLWFlcyE=",
  DATABASE_URL: "file:./dev.db",
  // Permet de tester l'endpoint webhook en local, avec une vraie signature.
  // En production, GENIUSPAY_WEBHOOK_SECRET est exige et cette valeur est
  // refusee (voir le controle plus bas).
  GENIUSPAY_WEBHOOK_SECRET: "whsec_sandbox_dev_local_only",
} as const;

function load() {
  const raw = { ...process.env } as Record<string, string | undefined>;

  // En dev et en test, on ne bloque pas sur les secrets : le parcours complet
  // doit rester lancable sans aucun service externe (docs/01 §7).
  if (raw.NODE_ENV !== "production") {
    for (const [key, value] of Object.entries(DEV_FALLBACKS)) {
      if (!raw[key]) raw[key] = value;
    }
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration EDENIA invalide :\n${details}`);
  }

  const parsedEnv = parsed.data;
  // Defaut sur : jamais de mode developpement implicite en production.
  const env = {
    ...parsedEnv,
    AUTH_MODE: parsedEnv.AUTH_MODE ?? (parsedEnv.NODE_ENV === "production" ? "production" : "development"),
  } as const;

  // `next build` s'execute avec NODE_ENV=production, mais un build n'a pas
  // besoin des secrets de production — les exiger la casserait toute chaine
  // d'integration. Le controle reste applique au demarrage du serveur, qui est
  // le moment ou un secret faible devient reellement dangereux.
  const isBuildPhase = raw.NEXT_PHASE === "phase-production-build";

  if (env.NODE_ENV === "production" && !isBuildPhase) {
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      throw new Error("AI_PROVIDER=anthropic exige ANTHROPIC_API_KEY.");
    }
    if (env.SESSION_SECRET === DEV_FALLBACKS.SESSION_SECRET) {
      throw new Error("SESSION_SECRET de developpement interdit en production.");
    }
    if (env.FIELD_ENCRYPTION_KEY === DEV_FALLBACKS.FIELD_ENCRYPTION_KEY) {
      throw new Error("FIELD_ENCRYPTION_KEY de developpement interdit en production.");
    }
    // Garde-fou le plus important de ce mode : une authentification simulee ne
    // doit jamais pouvoir tourner sur un serveur de production, meme par
    // erreur de configuration. L'application refuse de demarrer.
    // §6/§7 : impossible de partir en production avec GeniusPay sans ses cles,
    // et impossible de laisser l'environnement sandbox sur un site en ligne.
    if (env.PAYMENT_PROVIDER === "geniuspay") {
      if (!env.GENIUSPAY_API_KEY || !env.GENIUSPAY_API_SECRET) {
        throw new Error("PAYMENT_PROVIDER=geniuspay exige GENIUSPAY_API_KEY et GENIUSPAY_API_SECRET.");
      }
      if (!env.GENIUSPAY_WEBHOOK_SECRET) {
        throw new Error(
          "GENIUSPAY_WEBHOOK_SECRET est requis : sans lui, aucun webhook ne peut etre authentifie.",
        );
      }
      if (env.GENIUSPAY_WEBHOOK_SECRET === DEV_FALLBACKS.GENIUSPAY_WEBHOOK_SECRET) {
        throw new Error(
          "Secret webhook de developpement interdit en production : n'importe qui pourrait forger un paiement.",
        );
      }
      if (env.GENIUSPAY_ENVIRONMENT === "sandbox") {
        throw new Error("GENIUSPAY_ENVIRONMENT=sandbox interdit en production : les paiements seraient simules.");
      }
      if (env.GENIUSPAY_API_KEY.startsWith("pk_sandbox") || env.GENIUSPAY_API_SECRET.startsWith("sk_sandbox")) {
        throw new Error("Cles GeniusPay sandbox detectees en production. Utilisez les cles pk_live_/sk_live_.");
      }
    }

    if (env.AUTH_MODE === "development") {
      throw new Error(
        "AUTH_MODE=development est interdit en production : l'OTP serait previsible. " +
          "Retirez la variable ou passez-la a « production ».",
      );
    }
  }

  return env;
}

export const env = load();
export type Env = typeof env;
export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
