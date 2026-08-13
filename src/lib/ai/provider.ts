import type { RawExtraction } from "./guardrails";
import type { Topic } from "./schema";

/**
 * §48 — « AI Layer : couche independante permettant de changer de
 * fournisseur/modele IA ».
 *
 * Aucun code metier n'importe un SDK. Tout passe par cette interface, ce qui
 * permet trois choses : changer de fournisseur, tester sans reseau, et basculer
 * automatiquement sur le repli local si le budget ou la connexion lachent.
 */

export interface AiMessage {
  role: "assistant" | "user";
  content: string;
}

export interface NextQuestionInput {
  /** Historique complet du tour de conversation. */
  messages: AiMessage[];
  /** Sujet que le moteur d'onboarding veut couvrir maintenant. */
  topic: Topic;
  /** Sujets deja couverts, pour eviter les repetitions. */
  covered: Topic[];
  /** Prenom deja connu, s'il l'est — permet de personnaliser. */
  firstName?: string | null;
  /** §11 : dernier propos de l'utilisateur, pour rebondir dessus. */
  lastUserMessage?: string | null;
  turnIndex: number;
  maxTurns: number;
}

export interface NextQuestionOutput {
  text: string;
  /** Suggestions de reponses rapides, utiles en 3G et au pouce (§6). */
  quickReplies?: string[];
  usage?: TokenUsage;
}

export interface ExtractionInput {
  /** Texte cumule des propos de l'utilisateur uniquement. */
  transcript: string;
  /** Dernier message, souvent le plus informatif. */
  lastUserMessage: string;
  /** Cles deja renseignees : inutile de les re-extraire. */
  knownKeys: string[];
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface GenerateProfileTextInput {
  kind: "BIO" | "VALUES" | "MARRIAGE_VISION" | "LOOKING_FOR";
  /** Faits confirmes uniquement — l'IA redige, elle ne complete pas (§13). */
  facts: Array<{ label: string; value: string }>;
  firstName?: string | null;
  tone?: "SOBRE" | "CHALEUREUX";
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** §10-§11 : question suivante, adaptee aux reponses precedentes. */
  nextQuestion(input: NextQuestionInput): Promise<NextQuestionOutput>;
  /** §10 : texte libre -> donnees structurees, avec confiance et citation. */
  extract(input: ExtractionInput): Promise<{ extractions: RawExtraction[]; usage?: TokenUsage }>;
  /** §15 : generation des textes du profil a partir des faits confirmes. */
  generateProfileText(input: GenerateProfileTextInput): Promise<{ text: string; usage?: TokenUsage }>;
}

/** Erreur typee : permet au moteur de basculer sur le repli sans planter. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
