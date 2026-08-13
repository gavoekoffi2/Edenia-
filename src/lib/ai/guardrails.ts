import { getFieldSpec, type FieldSpec } from "./schema";

/**
 * Garde-fous de EDENIA AI.
 *
 * Deux regles du cahier des charges sont ici traduites en code executable, parce
 * qu'une consigne dans un prompt n'est pas une garantie :
 *
 *  §13 — « L'IA ne doit JAMAIS inventer. »
 *        => toute valeur extraite doit etre adossee a une citation reellement
 *           presente dans les propos de l'utilisateur. Sinon elle est rejetee,
 *           quel que soit le fournisseur de modele.
 *
 *  §40 — L'IA ne doit pas se substituer a Dieu, predire une destinee amoureuse,
 *        ni affirmer qu'une personne est « envoyee par Dieu ».
 *        => filtre de sortie sur chaque message assistant.
 */

export interface RawExtraction {
  key: string;
  value: unknown;
  confidence: number;
  sourceQuote?: string | null;
}

export type ExtractionStatus = "PROPOSED" | "NEEDS_CONFIRMATION" | "REJECTED";

export interface ValidatedExtraction {
  key: string;
  spec: FieldSpec;
  value: unknown;
  confidence: number;
  sourceQuote: string;
  status: ExtractionStatus;
  rejectionReason?: string;
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Verifie qu'une citation provient bien du transcript.
 * On compare sur une forme normalisee pour tolerer la ponctuation et les accents,
 * mais pas pour tolerer une reformulation : la citation doit etre presente.
 */
export function quoteIsGrounded(quote: string, transcript: string): boolean {
  const needle = normalizeForMatch(quote);
  if (needle.length < 3) return false;
  return normalizeForMatch(transcript).includes(needle);
}

function valueMatchesType(spec: FieldSpec, value: unknown): boolean {
  switch (spec.type) {
    case "string":
      return typeof value === "string" && value.trim().length > 0;
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      if (spec.min !== undefined && value < spec.min) return false;
      if (spec.max !== undefined && value > spec.max) return false;
      return true;
    }
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && (spec.enumValues?.includes(value) ?? false);
    case "string[]":
      return Array.isArray(value) && value.every((v) => typeof v === "string") && value.length > 0;
    default:
      return false;
  }
}

/**
 * Applique les regles du §13 a une extraction brute, d'ou qu'elle vienne
 * (modele distant ou extracteur local).
 */
export function validateExtraction(raw: RawExtraction, transcript: string): ValidatedExtraction | null {
  const spec = getFieldSpec(raw.key);
  if (!spec) return null; // hors contrat : le modele a invente un champ

  const reject = (reason: string): ValidatedExtraction => ({
    key: raw.key,
    spec,
    value: raw.value,
    confidence: raw.confidence,
    sourceQuote: raw.sourceQuote ?? "",
    status: "REJECTED",
    rejectionReason: reason,
  });

  if (!valueMatchesType(spec, raw.value)) {
    return reject("Valeur non conforme au type ou aux bornes du champ.");
  }

  const quote = (raw.sourceQuote ?? "").trim();
  if (!quote) {
    return reject("Aucune citation source : une donnée non prononcée ne peut pas être enregistrée (§13).");
  }
  if (!quoteIsGrounded(quote, transcript)) {
    return reject("La citation source est absente des propos de l'utilisateur (§13).");
  }

  const confidence = Math.min(1, Math.max(0, raw.confidence));

  // §13 : sous le seuil, ou champ important => on demande confirmation.
  const status: ExtractionStatus =
    confidence < spec.minConfidence || spec.requireConfirmation ? "NEEDS_CONFIRMATION" : "PROPOSED";

  return { key: raw.key, spec, value: raw.value, confidence, sourceQuote: quote, status };
}

export function validateExtractions(raws: RawExtraction[], transcript: string): ValidatedExtraction[] {
  const out: ValidatedExtraction[] = [];
  const seen = new Set<string>();

  for (const raw of raws) {
    const validated = validateExtraction(raw, transcript);
    if (!validated) continue;
    // En cas de doublon, on garde la meilleure confiance.
    const existing = out.findIndex((e) => e.key === validated.key);
    if (existing >= 0) {
      const prev = out[existing]!;
      if (validated.confidence > prev.confidence) out[existing] = validated;
      continue;
    }
    seen.add(validated.key);
    out.push(validated);
  }
  return out;
}

// ---------------------------------------------------------------------------
// §40 — ce que EDENIA AI n'a pas le droit de dire
// ---------------------------------------------------------------------------

interface ForbiddenPattern {
  pattern: RegExp;
  reason: string;
}

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    pattern: /\b(envoy[ée]e?\s+par\s+dieu|don\s+de\s+dieu\s+pour\s+toi)\b/i,
    reason: "Affirmer qu'une personne est envoyée par Dieu (§40).",
  },
  {
    pattern: /(?<!\p{L})([âa]me\s+s(?:œ|oe)ur)(?!\p{L})/iu,
    reason: "Promesse d'âme sœur (§64).",
  },
  {
    pattern: /\b(dieu\s+(?:t'|te\s+)?(?:a\s+)?(?:destin|r[ée]serv|pr[ée]par|choisi))/i,
    reason: "Prétendre connaître la volonté de Dieu pour l'utilisateur (§40).",
  },
  {
    pattern: /\b(c'est\s+(?:elle|lui)\s+que\s+dieu)/i,
    reason: "Désignation divine d'un partenaire (§40).",
  },
  {
    pattern: /\b(tu\s+vas\s+(?:certainement\s+|s[ûu]rement\s+)?(?:te\s+marier|[ée]pouser)\b)/i,
    reason: "Prédiction d'une destinée amoureuse (§40).",
  },
  {
    pattern: /\b(je\s+(?:te\s+)?(?:garantis|promets)\s+(?:que\s+)?(?:tu|vous))/i,
    reason: "Garantie sur l'issue d'une relation (§40, §60).",
  },
  {
    pattern: /\b(cette\s+personne\s+est\s+(?:honn[êe]te|fiable|s[ûu]re))\b/i,
    reason: "EDENIA ne garantit jamais l'honnêteté d'une personne (§60).",
  },
];

export interface GuardrailVerdict {
  allowed: boolean;
  violations: string[];
  /** Message de remplacement quand la sortie est bloquee. */
  safeAlternative?: string;
}

export function checkAssistantMessage(text: string): GuardrailVerdict {
  const violations: string[] = [];
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) violations.push(reason);
  }

  if (violations.length === 0) return { allowed: true, violations: [] };

  return {
    allowed: false,
    violations,
    safeAlternative:
      "Je préfère rester à ma place : je t'aide à présenter clairement qui tu es et ce que tu recherches. " +
      "Le discernement, lui, t'appartient — avec les personnes en qui tu as confiance. On continue ?",
  };
}

/** Filtre applique systematiquement avant d'afficher une reponse de l'IA. */
export function sanitizeAssistantMessage(text: string): { text: string; blocked: boolean; violations: string[] } {
  const verdict = checkAssistantMessage(text);
  if (verdict.allowed) return { text, blocked: false, violations: [] };
  return { text: verdict.safeAlternative!, blocked: true, violations: verdict.violations };
}
