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

  AI_PROVIDER: z.enum(["rulebased", "anthropic"]).default("rulebased"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  AI_MAX_TURNS: z.coerce.number().int().min(3).max(30).default(12),

  SMS_PROVIDER: z.string().default("console"),
  EMAIL_PROVIDER: z.string().default("console"),
  SMS_SENDER_ID: z.string().default("EDENIA"),

  PAYMENT_PROVIDER: z.string().default("simulated"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

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

  const env = parsed.data;

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
  }

  return env;
}

export const env = load();
export type Env = typeof env;
export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
