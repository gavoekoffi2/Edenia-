import { describe, expect, it } from "vitest";
import {
  checkAssistantMessage,
  quoteIsGrounded,
  sanitizeAssistantMessage,
  validateExtraction,
  validateExtractions,
} from "@/lib/ai/guardrails";
import { buildPreview, generateProfileSections, humanize } from "@/lib/ai/generate";
import { computeProgress, initialState, nextTopic, runTurn } from "@/lib/ai/onboarding";
import { RuleBasedAiProvider } from "@/lib/ai/providers/rulebased";
import { FIELD_SPECS } from "@/lib/ai/schema";

const provider = new RuleBasedAiProvider();

/** Le message exact donne en exemple au §10 du cahier des charges. */
const EXEMPLE_CDC =
  "Je m'appelle Claude, j'ai 31 ans, je suis entrepreneur dans le numérique, j'habite à Lomé " +
  "et je cherche une femme chrétienne sérieuse avec qui construire une relation pouvant aboutir au mariage.";

describe("extraction (§10)", () => {
  it("extrait les champs de l'exemple du cahier des charges", async () => {
    const { extractions } = await provider.extract({
      transcript: EXEMPLE_CDC,
      lastUserMessage: EXEMPLE_CDC,
      knownKeys: [],
    });
    const byKey = Object.fromEntries(extractions.map((e) => [e.key, e.value]));

    expect(byKey["Profile.firstName"]).toBe("Claude");
    expect(byKey["Profile.age"]).toBe(31);
    expect(byKey["Profile.cityLabel"]).toBe("Lomé");
    expect(byKey["Profile.countryCode"]).toBe("TG");
    expect(byKey["MarriageVision.wantsMarriage"]).toBe("YES");
    expect(String(byKey["Profile.profession"])).toContain("entrepreneur");
  });

  it("joint une citation reellement prononcee a chaque extraction (§13)", async () => {
    const { extractions } = await provider.extract({
      transcript: EXEMPLE_CDC,
      lastUserMessage: EXEMPLE_CDC,
      knownKeys: [],
    });
    expect(extractions.length).toBeGreaterThan(0);
    for (const extraction of extractions) {
      expect(extraction.sourceQuote).toBeTruthy();
      expect(quoteIsGrounded(extraction.sourceQuote!, EXEMPLE_CDC)).toBe(true);
    }
  });

  it("enregistre « à discuter » plutot que d'inventer une reponse (§13)", async () => {
    const phrase = "Je ne sais pas encore si je veux avoir des enfants.";
    const { extractions } = await provider.extract({
      transcript: phrase,
      lastUserMessage: phrase,
      knownKeys: [],
    });
    const children = extractions.find((e) => e.key === "MarriageVision.wantsChildren");
    expect(children?.value).toBe("UNDECIDED");
    expect(humanize("MarriageVision.wantsChildren", "UNDECIDED")).toBe("à discuter");
  });

  it("comprend la reponse sur la foi du §11", async () => {
    const phrase =
      "Elle est très importante pour moi, je prie tous les jours et je suis engagé dans mon église.";
    const { extractions } = await provider.extract({
      transcript: phrase,
      lastUserMessage: phrase,
      knownKeys: [],
    });
    const byKey = Object.fromEntries(extractions.map((e) => [e.key, e.value]));
    expect(byKey["FaithProfile.prayerImportance"]).toBe(5);
    expect(byKey["FaithProfile.commitmentLevel"]).toBe("COMMITTED");
  });

  it("ne confond pas une confession de foi avec un metier", async () => {
    const phrase = "Je suis chrétienne et célibataire.";
    const { extractions } = await provider.extract({
      transcript: phrase,
      lastUserMessage: phrase,
      knownKeys: [],
    });
    expect(extractions.find((e) => e.key === "Profile.profession")).toBeUndefined();
    expect(extractions.find((e) => e.key === "Profile.maritalStatus")?.value).toBe("SINGLE");
  });

  it("ne prend pas un pays pour une ville", async () => {
    const phrase = "J'habite au Togo depuis toujours.";
    const { extractions } = await provider.extract({
      transcript: phrase,
      lastUserMessage: phrase,
      knownKeys: [],
    });
    expect(extractions.find((e) => e.key === "Profile.cityLabel")).toBeUndefined();
    expect(extractions.find((e) => e.key === "Profile.countryCode")?.value).toBe("TG");
  });
});

describe("garde-fous — l'IA n'invente jamais (§13)", () => {
  const transcript = "Je m'appelle Awa et j'habite à Cotonou.";

  it("rejette une valeur sans citation source", () => {
    const result = validateExtraction(
      { key: "Profile.profession", value: "Médecin", confidence: 0.95, sourceQuote: null },
      transcript,
    );
    expect(result?.status).toBe("REJECTED");
    expect(result?.rejectionReason).toContain("citation");
  });

  it("rejette une citation absente du transcript, meme avec une confiance de 1", () => {
    const result = validateExtraction(
      { key: "Profile.profession", value: "Médecin", confidence: 1, sourceQuote: "je suis médecin" },
      transcript,
    );
    expect(result?.status).toBe("REJECTED");
  });

  it("rejette un champ hors du contrat d'extraction", () => {
    const result = validateExtraction(
      { key: "User.password", value: "x", confidence: 1, sourceQuote: "Awa" },
      transcript,
    );
    expect(result).toBeNull();
  });

  it("rejette une valeur hors des bornes declarees", () => {
    const result = validateExtraction(
      { key: "Profile.age", value: 12, confidence: 0.99, sourceQuote: "Awa" },
      transcript,
    );
    expect(result?.status).toBe("REJECTED");
  });

  it("rejette une valeur hors enumeration", () => {
    const result = validateExtraction(
      { key: "FaithProfile.denomination", value: "JEDI", confidence: 0.9, sourceQuote: "Awa" },
      transcript,
    );
    expect(result?.status).toBe("REJECTED");
  });

  it("exige une confirmation pour les informations importantes (§13)", () => {
    const result = validateExtraction(
      { key: "Profile.firstName", value: "Awa", confidence: 0.99, sourceQuote: "Je m'appelle Awa" },
      transcript,
    );
    expect(result?.status).toBe("NEEDS_CONFIRMATION");
  });

  it("garde la meilleure confiance en cas de doublon", () => {
    const results = validateExtractions(
      [
        { key: "Profile.cityLabel", value: "Cotonou", confidence: 0.6, sourceQuote: "Cotonou" },
        { key: "Profile.cityLabel", value: "Cotonou", confidence: 0.9, sourceQuote: "Cotonou" },
      ],
      transcript,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.confidence).toBe(0.9);
  });
});

describe("garde-fous — ce que l'IA ne doit pas dire (§40, §64)", () => {
  const interdits = [
    "Cette femme a été envoyée par Dieu pour toi.",
    "Tu as trouvé ton âme sœur !",
    "Dieu t'a destiné cette personne.",
    "Je te garantis que tu vas être heureux avec elle.",
    "Cette personne est honnête, tu peux lui faire confiance.",
  ];

  for (const message of interdits) {
    it(`bloque : « ${message.slice(0, 40)}… »`, () => {
      const verdict = checkAssistantMessage(message);
      expect(verdict.allowed).toBe(false);
      expect(verdict.violations.length).toBeGreaterThan(0);
    });
  }

  it("laisse passer un message normal", () => {
    const verdict = checkAssistantMessage("Quelle place la foi occupe-t-elle dans ta vie ?");
    expect(verdict.allowed).toBe(true);
  });

  it("remplace le message bloque par une alternative sobre", () => {
    const { text, blocked } = sanitizeAssistantMessage("Tu as trouvé ton âme sœur !");
    expect(blocked).toBe(true);
    expect(text).not.toContain("âme sœur");
    expect(text.length).toBeGreaterThan(20);
  });
});

describe("moteur d'onboarding (§9, §11, §61)", () => {
  it("ouvre la conversation sans rien demander de mecanique", async () => {
    const turn = await runTurn({ state: initialState(), history: [], userMessage: null, provider });
    expect(turn.assistantMessage).toContain("EDENIA");
    expect(turn.state.turnIndex).toBe(0);
  });

  it("progresse et retient le prenom au premier message", async () => {
    const turn = await runTurn({
      state: initialState(),
      history: [],
      userMessage: EXEMPLE_CDC,
      provider,
    });
    expect(turn.state.firstName).toBe("Claude");
    expect(turn.progress).toBeGreaterThan(0);
    expect(turn.state.knownKeys).toContain("Profile.age");
  });

  it("rebondit sur la reponse plutot que de derouler une liste (§11)", async () => {
    const state = initialState();
    const turn = await runTurn({
      state,
      history: [{ role: "user", content: EXEMPLE_CDC }],
      userMessage:
        "Elle est très importante pour moi, je prie tous les jours et je suis engagé dans mon église.",
      provider,
    });
    expect(turn.assistantMessage).toContain("prière à deux");
  });

  it("n'insiste pas apres un « je ne sais pas » (§13)", async () => {
    const turn = await runTurn({
      state: initialState(),
      history: [],
      userMessage: "Je ne sais pas encore si je veux avoir des enfants.",
      provider,
    });
    expect(turn.assistantMessage).toMatch(/discuter|valable/i);
  });

  it("s'arrete quand le budget de tours est atteint (§61 : pas de friction infinie)", async () => {
    let state = initialState();
    let history: Array<{ role: "assistant" | "user"; content: string }> = [];

    for (let i = 0; i < 20 && !state.done; i += 1) {
      const turn = await runTurn({ state, history, userMessage: "D'accord.", provider });
      history = [...history, { role: "user", content: "D'accord." }, { role: "assistant", content: turn.assistantMessage }];
      state = turn.state;
    }
    expect(state.done).toBe(true);
    expect(state.turnIndex).toBeLessThanOrEqual(13);
  });

  it("choisit le sujet suivant selon ce qui manque", () => {
    const state = initialState();
    expect(nextTopic(state)).toBe("IDENTITY");

    const advanced = {
      ...state,
      knownKeys: [
        "Profile.firstName",
        "Profile.age",
        "Profile.maritalStatus",
        "Profile.hasChildren",
        "Profile.cityLabel",
        "Profile.countryCode",
      ],
    };
    expect(nextTopic(advanced)).toBe("FAITH");
  });

  it("rend une progression bornee a 100", () => {
    const full = { ...initialState(), knownKeys: FIELD_SPECS.map((s) => s.key) };
    expect(computeProgress(full)).toBe(100);
  });
});

describe("generation du profil (§15)", () => {
  it("redige uniquement a partir des faits confirmes", async () => {
    const generated = await generateProfileSections(
      [
        { key: "Profile.firstName", value: "Claude" },
        { key: "Profile.age", value: 31 },
        { key: "Profile.cityLabel", value: "Lomé" },
        { key: "Profile.profession", value: "entrepreneur dans le numérique" },
        { key: "MarriageVision.wantsChildren", value: "UNDECIDED" },
      ],
      { provider },
    );

    expect(generated.bio).toContain("Claude");
    expect(generated.bio).toContain("Lomé");
    // Aucun fait sur la foi n'a ete confirme : rien ne doit apparaitre.
    expect(generated.bio.toLowerCase()).not.toContain("église");
    expect(generated.toDiscuss.map((t) => t.key)).toContain("MarriageVision.wantsChildren");
  });

  it("ne produit rien plutot que d'inventer quand il n'y a aucun fait", async () => {
    const generated = await generateProfileSections([], { provider });
    expect(generated.bio).toBe("");
    expect(generated.values).toBe("");
  });

  it("construit un apercu lisible pour la validation humaine (§14)", () => {
    const preview = buildPreview([
      { key: "Profile.firstName", value: "Claude", status: "NEEDS_CONFIRMATION" },
      { key: "FaithProfile.denomination", value: "EVANGELICAL", status: "PROPOSED" },
      { key: "Profile.profession", value: "Médecin", status: "REJECTED" },
    ]);

    expect(preview).toHaveLength(2);
    expect(preview[0]!.needsConfirmation).toBe(true);
    expect(preview[1]!.value).toBe("Évangélique");
  });
});
