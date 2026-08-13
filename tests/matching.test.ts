import { describe, expect, it } from "vitest";
import { productRules } from "@/lib/config/features";
import { checkMutual, passesHardFilters } from "@/lib/matching/dealbreakers";
import { explainMatch, suggestIcebreakers } from "@/lib/matching/explain";
import { adaptiveWeights, computeMatch, dimensionPercentages } from "@/lib/matching/score";
import { DIMENSIONS } from "@/lib/matching/types";
import { makeCandidate, makePair } from "./helpers/candidates";

describe("moteur de matching — score", () => {
  it("donne un score eleve a deux profils tres proches", () => {
    const [a, b] = makePair();
    const result = computeMatch(a, b);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe("HIGH");
    expect(result.blocked).toBe(false);
  });

  it("ne depasse jamais le plafond d'affichage (§21 : le score n'est pas une verite)", () => {
    const [a, b] = makePair();
    // Deux profils rigoureusement identiques : le score doit rester plafonne.
    const clone = makeCandidate({ ...b, core: { ...b.core, gender: "F", seeking: "M" } });
    const result = computeMatch(a, clone);
    expect(result.score).toBeLessThanOrEqual(productRules.maxDisplayedCompatibility);
    expect(result.score).toBeLessThan(100);
  });

  it("abaisse le score quand la vision du mariage diverge", () => {
    const [a, b] = makePair();
    const divergent = makeCandidate({
      ...b,
      marriage: {
        ...b.marriage,
        wantsChildren: "NO",
        timeline: "NO_RUSH",
        expatriation: "WANTED",
      },
    });
    const close = computeMatch(a, b);
    const far = computeMatch(a, divergent);
    expect(far.score).toBeLessThan(close.score);
  });

  it("traite « je ne sais pas encore » comme neutre, pas comme un desaccord (§13)", () => {
    const [a, b] = makePair();
    const undecided = makeCandidate({
      ...b,
      marriage: { ...b.marriage, wantsChildren: "UNDECIDED" },
    });
    const opposed = makeCandidate({
      ...b,
      marriage: { ...b.marriage, wantsChildren: "NO" },
    });

    const undecidedScore = computeMatch(a, undecided).score;
    const opposedScore = computeMatch(a, opposed).score;
    expect(undecidedScore).toBeGreaterThan(opposedScore);
  });

  it("baisse la confiance et tempere le score quand un profil est peu rempli", () => {
    const [a] = makePair();
    const sparse = makeCandidate({
      core: { gender: "F", seeking: "M" },
      faith: {
        denomination: null,
        commitmentLevel: null,
        attendance: null,
        prayerImportance: null,
        bibleReading: null,
        faithInCouple: null,
      },
      marriage: {
        wantsMarriage: null,
        timeline: null,
        wantsChildren: null,
        childrenDesired: null,
        financeModel: null,
        careerView: null,
        residenceAfter: null,
        expatriation: null,
        countryAfter: null,
      },
      family: {
        familyProximity: null,
        extendedFamilySupport: null,
        traditionsImportance: null,
        inLawsRole: null,
        dowryView: null,
      },
      personality: {
        openness: null,
        conscientiousness: null,
        extraversion: null,
        agreeableness: null,
        emotionality: null,
        conflictStyle: null,
      },
      lifestyle: { interests: [], smoking: null, alcohol: null, socialStyle: null },
    });

    const result = computeMatch(a, sparse);
    expect(result.confidence).toBe("LOW");
    expect(result.score).toBeLessThan(computeMatch(a, makeCandidate({ core: { gender: "F", seeking: "M" } })).score);
  });

  it("expose les sept dimensions du §20", () => {
    const [a, b] = makePair();
    const result = computeMatch(a, b);
    for (const key of DIMENSIONS) {
      expect(result.dimensions[key]).toBeDefined();
    }
    expect(DIMENSIONS).toHaveLength(7);
  });

  it("garde des poids normalises apres adaptation", () => {
    const viewer = makeCandidate({
      faith: { prayerImportance: 5 },
      preferences: { scope: "CITY" },
      dealbreakers: [{ key: "FAITH_PRACTICE", operator: "AT_LEAST", value: "COMMITTED" }],
    });
    const weights = adaptiveWeights(viewer);
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(weights.faith).toBeGreaterThan(0.24);
  });

  it("rend un pourcentage nul plutot qu'invente pour une dimension sans donnee", () => {
    const [a] = makePair();
    const noLifestyle = makeCandidate({
      core: { gender: "F", seeking: "M" },
      lifestyle: { interests: [], smoking: null, alcohol: null, socialStyle: null },
    });
    const result = computeMatch(a, noLifestyle);
    const lifestyle = dimensionPercentages(result).find((d) => d.key === "lifestyle");
    expect(lifestyle?.percent).toBeNull();
  });
});

describe("criteres essentiels (§22)", () => {
  it("bloque quand le critere essentiel du chercheur n'est pas satisfait", () => {
    const viewer = makeCandidate({
      dealbreakers: [{ key: "WANTS_CHILDREN", operator: "EQUALS", value: "YES" }],
    });
    const target = makeCandidate({
      core: { gender: "F", seeking: "M" },
      marriage: { wantsChildren: "NO" },
    });
    const result = computeMatch(viewer, target);
    expect(result.blocked).toBe(true);
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it("bloque aussi quand c'est le critere de la cible qui n'est pas satisfait (bilateral)", () => {
    const viewer = makeCandidate({ marriage: { wantsChildren: "NO" } });
    const target = makeCandidate({
      core: { gender: "F", seeking: "M" },
      dealbreakers: [{ key: "WANTS_CHILDREN", operator: "EQUALS", value: "YES" }],
    });
    const check = checkMutual(viewer, target);
    expect(check.passed).toBe(false);
    expect(check.targetReasons).toContain("Souhaite avoir des enfants");
  });

  it("distingue preference et critere essentiel : une preference ne bloque pas", () => {
    const viewer = makeCandidate({ preferences: { denominations: ["CATHOLIC"] } });
    const target = makeCandidate({
      core: { gender: "F", seeking: "M" },
      faith: { denomination: "PENTECOSTAL" },
    });
    const result = computeMatch(viewer, target);
    expect(result.blocked).toBe(false);
  });

  it("gere l'operateur AT_LEAST sur le niveau d'engagement", () => {
    const viewer = makeCandidate({
      dealbreakers: [{ key: "FAITH_PRACTICE", operator: "AT_LEAST", value: "COMMITTED" }],
    });
    const occasional = makeCandidate({
      core: { gender: "F", seeking: "M" },
      faith: { commitmentLevel: "OCCASIONAL" },
    });
    const serving = makeCandidate({
      core: { gender: "F", seeking: "M" },
      faith: { commitmentLevel: "SERVING" },
    });
    expect(computeMatch(viewer, occasional).blocked).toBe(true);
    expect(computeMatch(viewer, serving).blocked).toBe(false);
  });

  it("respecte la plage d'age des deux cotes", () => {
    const viewer = makeCandidate({ core: { age: 30 }, preferences: { ageMin: 25, ageMax: 35 } });
    const tooYoungForViewer = makeCandidate({ core: { gender: "F", seeking: "M", age: 22 } });
    const rejectsViewer = makeCandidate({
      core: { gender: "F", seeking: "M", age: 30 },
      preferences: { ageMin: 35, ageMax: 45 },
    });
    expect(passesHardFilters(viewer, tooYoungForViewer)).toBe(false);
    expect(passesHardFilters(viewer, rejectsViewer)).toBe(false);
  });

  it("exclut un profil sans canal de contact verifie", () => {
    const viewer = makeCandidate();
    const unverified = makeCandidate({ core: { gender: "F", seeking: "M", isVerifiedContact: false } });
    expect(passesHardFilters(viewer, unverified)).toBe(false);
  });
});

describe("explication du match (§21)", () => {
  it("accompagne toujours le score d'un pourquoi et d'un avertissement", () => {
    const [a, b] = makePair();
    const result = computeMatch(a, b);
    const explanation = explainMatch(a, b, result);

    expect(explanation.why.length).toBeGreaterThan(0);
    expect(explanation.toDiscover.length).toBeGreaterThan(0);
    expect(explanation.disclaimer).toContain("indicatif");
    expect(explanation.headline).toContain("%");
  });

  it("ne revele pas le contenu d'une dimension marquee privee (C5)", () => {
    const [a, b] = makePair();
    const privateTarget = makeCandidate({
      ...b,
      visibility: { marriage: "PRIVATE", faith: "PRIVATE" },
      marriage: { ...b.marriage, expatriation: "WANTED" },
    });
    const result = computeMatch(a, privateTarget);
    const explanation = explainMatch(a, privateTarget, result, { isMatched: false });

    const all = [...explanation.why, ...explanation.toDiscover].join(" ");
    expect(all).not.toContain("expatriation");
    expect(all).not.toContain("dénomination");
  });

  it("ouvre les dimensions « MATCHES » une fois le match etabli", () => {
    const [a, b] = makePair();
    const target = makeCandidate({ ...b, visibility: { faith: "MATCHES" } });
    const result = computeMatch(a, target);

    const before = explainMatch(a, target, result, { isMatched: false });
    const after = explainMatch(a, target, result, { isMatched: true });
    expect(JSON.stringify(after.why)).not.toBe(JSON.stringify(before.why));
  });

  it("signale explicitement un score peu fiable", () => {
    const [a] = makePair();
    const sparse = makeCandidate({
      core: { gender: "F", seeking: "M" },
      faith: { denomination: null, commitmentLevel: null, attendance: null, prayerImportance: null, bibleReading: null, faithInCouple: null },
      marriage: { wantsMarriage: null, timeline: null, wantsChildren: null, childrenDesired: null, financeModel: null, careerView: null, residenceAfter: null, expatriation: null, countryAfter: null },
      family: { familyProximity: null, extendedFamilySupport: null, traditionsImportance: null, inLawsRole: null, dowryView: null },
      personality: { openness: null, conscientiousness: null, extraversion: null, agreeableness: null, emotionality: null, conflictStyle: null },
      lifestyle: { interests: [], smoking: null, alcohol: null, socialStyle: null },
    });
    const result = computeMatch(a, sparse);
    const explanation = explainMatch(a, sparse, result);
    expect(explanation.lowDataNotice).not.toBeNull();
  });

  it("propose des questions sur les sujets les moins couverts (§33)", () => {
    const [a, b] = makePair();
    const result = computeMatch(a, b);
    const questions = suggestIcebreakers(result);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0]).toHaveProperty("question");
  });
});

describe("localisation (§24, C4)", () => {
  it("classe meme ville > meme region > meme pays", () => {
    const viewer = makeCandidate();
    const sameCity = makeCandidate({ core: { gender: "F", seeking: "M" } });
    const sameRegion = makeCandidate({
      core: { gender: "F", seeking: "M" },
      location: { cityId: "tg-tsevie", cityLat: 6.4264, cityLng: 1.2131 },
    });
    const sameCountry = makeCandidate({
      core: { gender: "F", seeking: "M" },
      location: { cityId: "tg-kara", regionId: "tg-kara-region", cityLat: 9.5511, cityLng: 1.1861 },
    });

    const s1 = computeMatch(viewer, sameCity).dimensions.location.score ?? 0;
    const s2 = computeMatch(viewer, sameRegion).dimensions.location.score ?? 0;
    const s3 = computeMatch(viewer, sameCountry).dimensions.location.score ?? 0;

    expect(s1).toBeGreaterThan(s2);
    expect(s2).toBeGreaterThan(s3);
  });

  it("n'ecrase pas la diaspora quand l'ouverture est declaree (§23)", () => {
    const viewer = makeCandidate({ preferences: { openToDiaspora: true } });
    const diaspora = makeCandidate({
      core: { gender: "F", seeking: "M" },
      location: { countryCode: "FR", regionId: "fr-idf", cityId: "fr-paris", cityLat: 48.85, cityLng: 2.35, isDiaspora: true },
    });
    const closed = makeCandidate({ ...viewer, preferences: { ...viewer.preferences, openToDiaspora: false } });

    const open = computeMatch(viewer, diaspora).dimensions.location.score ?? 0;
    const shut = computeMatch(closed, diaspora).dimensions.location.score ?? 0;
    expect(open).toBeGreaterThan(shut);
  });
});
