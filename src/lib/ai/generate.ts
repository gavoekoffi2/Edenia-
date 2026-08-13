import {
  ATTENDANCE,
  COMMITMENT_LEVEL,
  DENOMINATION_LABEL,
  EXPATRIATION,
  type Denomination,
} from "@/lib/config/enums";
import type { AiProvider, GenerateProfileTextInput } from "./provider";
import { getProvider } from "./onboarding";
import { getFieldSpec } from "./schema";
import { sanitizeAssistantMessage } from "./guardrails";

/**
 * §15 — generation automatique des textes du profil.
 *
 * Regle structurante : la generation ne part **que** des faits confirmes. L'IA
 * met en forme, elle ne complete pas. Un champ non confirme n'entre pas dans la
 * redaction, meme s'il rendrait le texte plus joli — c'est la traduction directe
 * du §13 et du §14 (« l'utilisateur garde toujours le controle »).
 */

export interface ConfirmedFact {
  key: string;
  value: unknown;
}

const HUMAN_VALUES: Record<string, Record<string, string>> = {
  "FaithProfile.commitmentLevel": {
    OCCASIONAL: "présence occasionnelle",
    REGULAR: "présence régulière",
    COMMITTED: "engagement fort dans son église",
    SERVING: "service actif dans son église",
  },
  "FaithProfile.attendance": {
    RARELY: "rarement",
    MONTHLY: "une fois par mois",
    WEEKLY: "chaque semaine",
    MULTIPLE_WEEKLY: "plusieurs fois par semaine",
  },
  "FaithProfile.bibleReading": {
    RARELY: "rarement",
    SOMETIMES: "de temps en temps",
    WEEKLY: "chaque semaine",
    DAILY: "chaque jour",
  },
  "MarriageVision.wantsMarriage": {
    YES: "souhaite se marier",
    PROBABLY: "s'oriente vers le mariage",
    UNDECIDED: "à discuter",
  },
  "MarriageVision.wantsChildren": {
    YES: "souhaite des enfants",
    NO: "ne souhaite pas d'enfants",
    // §13 : la formulation exacte demandee par le cahier des charges.
    UNDECIDED: "à discuter",
  },
  "MarriageVision.timeline": {
    WITHIN_1Y: "dans l'année qui vient",
    WITHIN_2Y: "d'ici deux ans",
    WITHIN_5Y: "d'ici cinq ans",
    NO_RUSH: "sans précipitation",
    UNDECIDED: "à discuter",
  },
  "MarriageVision.expatriation": {
    WANTED: "souhaite vivre à l'étranger",
    OPEN: "ouvert(e) à l'expatriation",
    PREFER_STAY: "préfère rester au pays",
    REFUSED: "ne souhaite pas s'expatrier",
    UNDECIDED: "à discuter",
  },
  "MarriageVision.financeModel": {
    POOLED: "finances mises en commun",
    SEPARATE: "finances séparées",
    MIXED: "un peu des deux",
    UNDECIDED: "à discuter",
  },
  "MarriageVision.residenceAfter": {
    OWN_HOME: "un foyer indépendant",
    WITH_FAMILY: "proche de la famille",
    UNDECIDED: "à discuter",
  },
  "FamilyPreferences.extendedFamilySupport": {
    ESSENTIAL: "soutenir la famille élargie est essentiel",
    IMPORTANT: "soutenir la famille élargie compte",
    OCCASIONAL: "aide ponctuelle à la famille",
    LIMITED: "soutien limité à la famille élargie",
    UNDECIDED: "à discuter",
  },
  "Profile.maritalStatus": {
    SINGLE: "célibataire",
    SEPARATED: "séparé(e)",
    DIVORCED: "divorcé(e)",
    WIDOWED: "veuf/veuve",
  },
  "Profile.education": {
    NONE: "sans diplôme",
    SECONDARY: "niveau secondaire",
    VOCATIONAL: "formation professionnelle",
    BACHELOR: "licence",
    MASTER: "master",
    DOCTORATE: "doctorat",
  },
  "Lifestyle.socialStyle": {
    HOMEBODY: "plutôt casanier(ère)",
    BALANCED: "équilibré(e)",
    OUTGOING: "plutôt sortant(e)",
  },
};

/** Rend une valeur brute lisible en francais, sans rien y ajouter. */
export function humanize(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";

  if (key === "FaithProfile.denomination" && typeof value === "string") {
    return DENOMINATION_LABEL[value as Denomination] ?? value;
  }
  if (key === "FaithProfile.prayerImportance" && typeof value === "number") {
    const scale = ["", "peu présente", "occasionnelle", "régulière", "importante", "centrale"];
    return scale[value] ?? String(value);
  }
  if (key === "FamilyPreferences.traditionsImportance" && typeof value === "number") {
    const scale = ["", "peu attaché(e) aux traditions", "peu attaché(e) aux traditions", "attaché(e) aux traditions", "très attaché(e) aux traditions", "très attaché(e) aux traditions"];
    return scale[value] ?? String(value);
  }

  const map = HUMAN_VALUES[key];
  if (map && typeof value === "string" && map[value]) return map[value];

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "oui" : "non";
  return String(value);
}

function factsFor(keys: string[], facts: ConfirmedFact[]): GenerateProfileTextInput["facts"] {
  const byKey = new Map(facts.map((f) => [f.key, f.value]));
  const out: GenerateProfileTextInput["facts"] = [];
  for (const key of keys) {
    if (!byKey.has(key)) continue;
    const spec = getFieldSpec(key);
    const rendered = humanize(key, byKey.get(key));
    if (!rendered) continue;
    out.push({ label: spec?.labelFr ?? key, value: rendered });
  }
  return out;
}

const SECTION_KEYS: Record<GenerateProfileTextInput["kind"], string[]> = {
  BIO: [
    "Profile.firstName",
    "Profile.age",
    "Profile.profession",
    "Profile.cityLabel",
    "Profile.maritalStatus",
    "FaithProfile.faithInCouple",
  ],
  VALUES: [
    "FaithProfile.denomination",
    "FaithProfile.commitmentLevel",
    "FaithProfile.prayerImportance",
    "FamilyPreferences.traditionsImportance",
    "FamilyPreferences.extendedFamilySupport",
  ],
  MARRIAGE_VISION: [
    "MarriageVision.wantsMarriage",
    "MarriageVision.timeline",
    "MarriageVision.wantsChildren",
    "MarriageVision.childrenDesired",
    "MarriageVision.residenceAfter",
    "MarriageVision.expatriation",
    "MarriageVision.financeModel",
  ],
  LOOKING_FOR: ["MarriageVision.wantsMarriage", "FaithProfile.faithInCouple", "Lifestyle.interests"],
};

export interface GeneratedProfile {
  bio: string;
  values: string;
  marriageVision: string;
  lookingFor: string;
  interests: string[];
  /** Champs enregistres comme « à discuter » (§13) — affiches tels quels. */
  toDiscuss: Array<{ label: string; key: string }>;
}

export async function generateProfileSections(
  facts: ConfirmedFact[],
  options: { firstName?: string | null; provider?: AiProvider } = {},
): Promise<GeneratedProfile> {
  const provider = options.provider ?? getProvider();
  const firstName =
    options.firstName ??
    (facts.find((f) => f.key === "Profile.firstName")?.value as string | undefined) ??
    null;

  const kinds: GenerateProfileTextInput["kind"][] = ["BIO", "VALUES", "MARRIAGE_VISION", "LOOKING_FOR"];
  const texts: Record<string, string> = {};

  for (const kind of kinds) {
    const selected = factsFor(SECTION_KEYS[kind], facts);
    if (selected.length === 0) {
      texts[kind] = "";
      continue;
    }
    try {
      const { text } = await provider.generateProfileText({ kind, facts: selected, firstName });
      // §40 : meme un texte de profil genere passe par le filtre.
      texts[kind] = sanitizeAssistantMessage(text).text;
    } catch {
      texts[kind] = "";
    }
  }

  const interestsFact = facts.find((f) => f.key === "Lifestyle.interests");
  const interests = Array.isArray(interestsFact?.value) ? (interestsFact.value as string[]) : [];

  const toDiscuss = facts
    .filter((f) => f.value === "UNDECIDED")
    .map((f) => ({ key: f.key, label: getFieldSpec(f.key)?.labelFr ?? f.key }));

  return {
    bio: texts.BIO ?? "",
    values: texts.VALUES ?? "",
    marriageVision: texts.MARRIAGE_VISION ?? "",
    lookingFor: texts.LOOKING_FOR ?? "",
    interests,
    toDiscuss,
  };
}

/**
 * §14 — apercu presente avant validation. On expose les faits tels qu'ils
 * seront enregistres, pour que la correction soit possible champ par champ.
 */
export interface ProfilePreviewRow {
  key: string;
  label: string;
  value: string;
  needsConfirmation: boolean;
}

export function buildPreview(
  extractions: Array<{ key: string; value: unknown; status: string }>,
): ProfilePreviewRow[] {
  return extractions
    .filter((e) => e.status !== "REJECTED")
    .map((e) => {
      const spec = getFieldSpec(e.key);
      return {
        key: e.key,
        label: spec?.labelFr ?? e.key,
        value: humanize(e.key, e.value),
        needsConfirmation: e.status === "NEEDS_CONFIRMATION",
      };
    })
    .filter((row) => row.value.length > 0);
}

export const KNOWN_ENUMS = { COMMITMENT_LEVEL, ATTENDANCE, EXPATRIATION };
