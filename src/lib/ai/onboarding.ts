import { env } from "@/lib/config/env";
import { sanitizeAssistantMessage, validateExtractions, type ValidatedExtraction } from "./guardrails";
import type { AiMessage, AiProvider } from "./provider";
import { AiProviderError } from "./provider";
import { RuleBasedAiProvider } from "./providers/rulebased";
import { ESSENTIAL_KEYS, TOPICS, fieldsForTopic, type Topic } from "./schema";

/**
 * §9 a §14 — moteur de l'onboarding conversationnel.
 *
 * Il decide **quoi demander ensuite**, applique les garde-fous, et sait s'arreter.
 * Le fournisseur IA ne pilote pas la conversation : il la formule. Cette
 * separation evite qu'un modele bavard fasse durer l'inscription — le §61
 * demande explicitement le minimum de friction.
 */

export interface OnboardingState {
  turnIndex: number;
  covered: Topic[];
  /** Cles deja acquises (statut PROPOSED ou CONFIRMED). */
  knownKeys: string[];
  firstName: string | null;
  done: boolean;
  /** True si le fournisseur distant a echoue et qu'on est repasse en local. */
  usedFallback: boolean;
}

export function initialState(): OnboardingState {
  return { turnIndex: 0, covered: [], knownKeys: [], firstName: null, done: false, usedFallback: false };
}

/**
 * Ordre de priorite des sujets. L'identite et la localisation d'abord (elles
 * conditionnent la decouverte), la foi et le mariage ensuite (le coeur du
 * produit), le reste si le budget de tours le permet.
 */
const TOPIC_ORDER: Topic[] = [
  "IDENTITY",
  "LOCATION",
  "FAITH",
  "MARRIAGE",
  "WORK",
  "FAMILY",
  "LIFESTYLE",
  "EXPECTATIONS",
];

/** Un sujet est considere couvert quand ses champs importants sont acquis. */
export function topicIsSatisfied(topic: Topic, knownKeys: Set<string>): boolean {
  const specs = fieldsForTopic(topic).filter((s) => s.importance !== "NICE");
  if (specs.length === 0) return knownKeys.size > 0;
  return specs.every((spec) => knownKeys.has(spec.key));
}

export function nextTopic(state: OnboardingState): Topic {
  const known = new Set(state.knownKeys);
  for (const topic of TOPIC_ORDER) {
    if (!topicIsSatisfied(topic, known)) return topic;
  }
  return "EXPECTATIONS";
}

export interface OnboardingTurnInput {
  state: OnboardingState;
  /** Historique complet, le plus ancien d'abord. */
  history: AiMessage[];
  /** Message que l'utilisateur vient d'envoyer (null au tout premier tour). */
  userMessage: string | null;
  provider?: AiProvider;
}

export interface OnboardingTurnOutput {
  assistantMessage: string;
  quickReplies: string[];
  extractions: ValidatedExtraction[];
  state: OnboardingState;
  progress: number; // 0-100
  /** Renseigne si un message de l'IA a du etre remplace (§40). */
  guardrailViolations: string[];
}

let cachedProvider: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;
  if (env.AI_PROVIDER === "anthropic") {
    // Import paresseux : evite de charger le client quand il n'est pas utilise.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AnthropicAiProvider } = require("./providers/anthropic") as typeof import("./providers/anthropic");
    cachedProvider = new AnthropicAiProvider();
  } else {
    cachedProvider = new RuleBasedAiProvider();
  }
  return cachedProvider;
}

/** Pour les tests et l'injection explicite. */
export function setProvider(provider: AiProvider | null): void {
  cachedProvider = provider;
}

const FALLBACK = new RuleBasedAiProvider();

export async function runTurn(input: OnboardingTurnInput): Promise<OnboardingTurnOutput> {
  const provider = input.provider ?? getProvider();
  const state: OnboardingState = { ...input.state, covered: [...input.state.covered], knownKeys: [...input.state.knownKeys] };

  const transcript = [...input.history.filter((m) => m.role === "user").map((m) => m.content), input.userMessage ?? ""]
    .filter(Boolean)
    .join("\n");

  let extractions: ValidatedExtraction[] = [];
  const violations: string[] = [];

  // --- 1. Extraction sur ce que la personne vient de dire -------------------
  if (input.userMessage && input.userMessage.trim().length > 0) {
    let raw: Awaited<ReturnType<AiProvider["extract"]>>;
    try {
      raw = await provider.extract({
        transcript,
        lastUserMessage: input.userMessage,
        knownKeys: state.knownKeys,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      state.usedFallback = true;
      raw = await FALLBACK.extract({
        transcript,
        lastUserMessage: input.userMessage,
        knownKeys: state.knownKeys,
      });
    }

    // §13 : le filtre s'applique quel que soit le fournisseur.
    extractions = validateExtractions(raw.extractions, transcript);

    for (const extraction of extractions) {
      if (extraction.status === "REJECTED") continue;
      if (!state.knownKeys.includes(extraction.key)) state.knownKeys.push(extraction.key);
      if (extraction.key === "Profile.firstName" && typeof extraction.value === "string") {
        state.firstName = extraction.value;
      }
    }

    const topic = nextTopic({ ...state, knownKeys: state.knownKeys });
    if (!state.covered.includes(topic)) state.covered.push(topic);
    state.turnIndex += 1;
  }

  // --- 2. Fin de conversation ? --------------------------------------------
  const known = new Set(state.knownKeys);
  const essentialsDone = ESSENTIAL_KEYS.every((key) => known.has(key));
  const budgetSpent = state.turnIndex >= env.AI_MAX_TURNS;
  const allTopicsDone = TOPICS.every((topic) => topicIsSatisfied(topic, known));

  state.done = (essentialsDone && allTopicsDone) || budgetSpent;

  // --- 3. Question suivante -------------------------------------------------
  const topic = nextTopic(state);
  let assistantMessage: string;
  let quickReplies: string[] = [];

  if (state.done) {
    assistantMessage =
      "✨ J'ai de quoi préparer ton profil. Tu vas pouvoir tout relire, corriger, puis valider — rien n'est publié avant ton accord.";
  } else {
    let question: Awaited<ReturnType<AiProvider["nextQuestion"]>>;
    try {
      question = await provider.nextQuestion({
        messages: input.history,
        topic,
        covered: state.covered,
        firstName: state.firstName,
        lastUserMessage: input.userMessage,
        turnIndex: state.turnIndex,
        maxTurns: env.AI_MAX_TURNS,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      state.usedFallback = true;
      question = await FALLBACK.nextQuestion({
        messages: input.history,
        topic,
        covered: state.covered,
        firstName: state.firstName,
        lastUserMessage: input.userMessage,
        turnIndex: state.turnIndex,
        maxTurns: env.AI_MAX_TURNS,
      });
    }

    // §40 : filtre de sortie systematique.
    const safe = sanitizeAssistantMessage(question.text);
    assistantMessage = safe.text;
    if (safe.blocked) violations.push(...safe.violations);
    quickReplies = question.quickReplies ?? [];
  }

  return {
    assistantMessage,
    quickReplies,
    extractions,
    state,
    progress: computeProgress(state),
    guardrailViolations: violations,
  };
}

/** Progression affichee : combinaison de l'avancement des sujets et des essentiels. */
export function computeProgress(state: OnboardingState): number {
  const known = new Set(state.knownKeys);
  const essentialsDone = ESSENTIAL_KEYS.filter((key) => known.has(key)).length;
  const essentialRatio = ESSENTIAL_KEYS.length === 0 ? 1 : essentialsDone / ESSENTIAL_KEYS.length;
  const topicsDone = TOPICS.filter((topic) => topicIsSatisfied(topic, known)).length;
  const topicRatio = topicsDone / TOPICS.length;
  return Math.min(100, Math.round((essentialRatio * 0.6 + topicRatio * 0.4) * 100));
}
