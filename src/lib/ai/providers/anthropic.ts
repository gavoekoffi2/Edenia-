import { env } from "@/lib/config/env";
import type { RawExtraction } from "../guardrails";
import { AiProviderError, type AiProvider, type ExtractionInput, type GenerateProfileTextInput, type NextQuestionInput, type NextQuestionOutput, type TokenUsage } from "../provider";
import { FIELD_SPECS, TOPIC_LABEL, fieldsForTopic } from "../schema";

/**
 * Implementation Anthropic de la couche IA.
 *
 * Elle n'a aucun privilege particulier : sa sortie passe par les memes garde-fous
 * que le fournisseur local (guardrails.ts). En particulier, une extraction sans
 * citation verifiable est rejetee meme si le modele l'affirme avec assurance —
 * c'est la seule facon de tenir le §13 en pratique.
 *
 * Pas de SDK : un simple appel HTTP, pour garder la couche IA sans dependance
 * lourde et facilement remplacable (§48).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

const SYSTEM_ONBOARDING = `Tu es EDENIA AI, l'assistant d'inscription d'EDENIA, une plateforme de rencontres chrétiennes pour l'Afrique francophone.

Ton rôle : mener une conversation naturelle et chaleureuse pour aider la personne à construire son profil, sans lui faire remplir de formulaire.

Règles absolues :
- Une seule question à la fois, courte, en français simple et tutoyé.
- Rebondis sur ce que la personne vient de dire ; ne déroule jamais une liste mécanique.
- N'invente jamais une information. Si la personne hésite, accepte « je ne sais pas encore » comme une réponse valable et passe à la suite.
- Ne te substitue pas à Dieu : pas de prophétie, pas d'« âme sœur », pas de « cette personne t'est destinée », aucune promesse sur l'issue d'une relation.
- Ne juge jamais un choix de vie, une dénomination ou une situation familiale.
- Pas d'emoji au-delà d'un par message, jamais de ton commercial.
- Reste sobre : maximum deux phrases.`;

const EXTRACTION_TOOL_NAME = "enregistrer_donnees_profil";

function buildExtractionTool() {
  const allowedKeys = FIELD_SPECS.map((spec) => spec.key);
  const description = FIELD_SPECS.map((spec) => {
    const values = spec.enumValues ? ` — valeurs autorisées : ${spec.enumValues.join(", ")}` : "";
    return `${spec.key} (${spec.type}) : ${spec.labelFr}${values}`;
  }).join("\n");

  return {
    name: EXTRACTION_TOOL_NAME,
    description: `Enregistre uniquement les informations RÉELLEMENT exprimées par la personne.\n\nChamps autorisés :\n${description}\n\nPour chaque champ, "source_quote" doit être un extrait EXACT et VERBATIM des propos de la personne. Si tu ne peux pas citer, n'enregistre pas le champ.`,
    input_schema: {
      type: "object",
      properties: {
        donnees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: allowedKeys },
              value: {},
              confidence: { type: "number", minimum: 0, maximum: 1 },
              source_quote: { type: "string" },
            },
            required: ["key", "value", "confidence", "source_quote"],
          },
        },
      },
      required: ["donnees"],
    },
  };
}

export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? env.ANTHROPIC_API_KEY;
    if (!key) throw new AiProviderError("ANTHROPIC_API_KEY manquante.");
    this.apiKey = key;
    this.model = model ?? env.ANTHROPIC_MODEL;
  }

  private async call(body: Record<string, unknown>, timeoutMs = 20_000): Promise<AnthropicResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({ model: this.model, ...body }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AiProviderError(`Anthropic HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }
      return (await response.json()) as AnthropicResponse;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError("Appel Anthropic impossible.", error);
    } finally {
      clearTimeout(timer);
    }
  }

  private usageOf(response: AnthropicResponse): TokenUsage {
    return {
      input: response.usage?.input_tokens ?? 0,
      output: response.usage?.output_tokens ?? 0,
    };
  }

  async nextQuestion(input: NextQuestionInput): Promise<NextQuestionOutput> {
    const remaining = input.maxTurns - input.turnIndex;
    const targetFields = fieldsForTopic(input.topic)
      .map((spec) => spec.labelFr)
      .join(", ");

    const guidance = [
      `Sujet à aborder maintenant : ${TOPIC_LABEL[input.topic]}.`,
      `Informations utiles à faire émerger : ${targetFields}.`,
      `Sujets déjà couverts : ${input.covered.map((t) => TOPIC_LABEL[t]).join(", ") || "aucun"}.`,
      `Il reste environ ${remaining} échanges : va à l'essentiel.`,
      input.firstName ? `La personne s'appelle ${input.firstName}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await this.call({
      max_tokens: 300,
      system: SYSTEM_ONBOARDING,
      messages: [
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: `[Consigne interne, ne pas mentionner]\n${guidance}` },
      ],
    });

    const text = (response.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) throw new AiProviderError("Réponse Anthropic vide.");
    return { text, usage: this.usageOf(response) };
  }

  async extract(input: ExtractionInput): Promise<{ extractions: RawExtraction[]; usage?: TokenUsage }> {
    const tool = buildExtractionTool();
    const known = input.knownKeys.length > 0 ? `\n\nDéjà renseignés (ne pas répéter) : ${input.knownKeys.join(", ")}.` : "";

    const response = await this.call({
      max_tokens: 1500,
      system:
        "Tu extrais des données structurées à partir des propos d'un utilisateur. " +
        "Tu n'inventes rien, tu ne déduis rien qui ne soit pas dit. " +
        "Une hésitation (« je ne sais pas encore ») se traduit par la valeur UNDECIDED quand le champ le permet, jamais par un choix arbitraire.",
      tools: [tool],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [
        {
          role: "user" as const,
          content: `Propos de la personne (dernier message d'abord) :\n\n--- DERNIER MESSAGE ---\n${input.lastUserMessage}\n\n--- CONVERSATION COMPLÈTE ---\n${input.transcript}${known}`,
        },
      ],
    });

    const toolUse = (response.content ?? []).find(
      (block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME,
    );
    if (!toolUse?.input) return { extractions: [], usage: this.usageOf(response) };

    const payload = toolUse.input as { donnees?: Array<Record<string, unknown>> };
    const extractions: RawExtraction[] = (payload.donnees ?? []).map((row) => ({
      key: String(row.key ?? ""),
      value: row.value,
      confidence: typeof row.confidence === "number" ? row.confidence : 0,
      sourceQuote: typeof row.source_quote === "string" ? row.source_quote : null,
    }));

    return { extractions, usage: this.usageOf(response) };
  }

  async generateProfileText(input: GenerateProfileTextInput): Promise<{ text: string; usage?: TokenUsage }> {
    const instructions: Record<GenerateProfileTextInput["kind"], string> = {
      BIO: "Rédige une présentation à la première personne, 2 à 3 phrases, naturelle et sobre.",
      VALUES: "Résume les valeurs de cette personne en 3 à 5 puces courtes.",
      MARRIAGE_VISION: "Résume la vision du mariage en 3 à 4 puces courtes et concrètes.",
      LOOKING_FOR: "Rédige en 2 phrases ce que cette personne recherche chez l'autre.",
    };

    const facts = input.facts.map((f) => `- ${f.label} : ${f.value}`).join("\n");

    const response = await this.call({
      max_tokens: 500,
      system:
        "Tu rédiges des textes de profil pour EDENIA. " +
        "Tu utilises UNIQUEMENT les faits fournis : tu n'ajoutes aucun détail, aucune qualité, aucune anecdote. " +
        "Ton sobre et digne, jamais publicitaire. Pas de superlatif. Pas de promesse spirituelle.",
      messages: [
        {
          role: "user" as const,
          content: `${instructions[input.kind]}\n\nFaits confirmés par la personne :\n${facts}\n\nRéponds uniquement par le texte final, sans introduction.`,
        },
      ],
    });

    const text = (response.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    return { text, usage: this.usageOf(response) };
  }
}
