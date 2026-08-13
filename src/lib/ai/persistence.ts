import { prisma } from "@/lib/db/client";
import { productRules } from "@/lib/config/features";
import { generateProfileSections, humanize, type ConfirmedFact } from "./generate";
import { initialState, runTurn, type OnboardingState } from "./onboarding";
import { getFieldSpec } from "./schema";
import type { AiMessage } from "./provider";

/**
 * Persistance de l'onboarding IA. Separee du moteur pour que celui-ci reste
 * testable sans base (tests/ai.test.ts).
 */

export interface TurnResponse {
  conversationId: string;
  assistantMessage: string;
  quickReplies: string[];
  progress: number;
  done: boolean;
  /** §14 : ce qui vient d'etre compris, presente pour relecture immediate. */
  understood: Array<{ key: string; label: string; value: string; needsConfirmation: boolean }>;
  usedFallback: boolean;
}

async function getOrCreateConversation(userId: string) {
  const existing = await prisma.aIConversation.findFirst({
    where: { userId, purpose: "ONBOARDING", completedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.aIConversation.create({
    data: { userId, purpose: "ONBOARDING", state: JSON.stringify(initialState()) },
  });
}

function parseState(raw: string): OnboardingState {
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
}

export async function handleOnboardingTurn(
  userId: string,
  userMessage: string | null,
  inputMode: "TEXT" | "VOICE" = "TEXT",
  transcriptEdited = false,
): Promise<TurnResponse> {
  const conversation = await getOrCreateConversation(userId);
  const state = parseState(conversation.state);

  const answers = await prisma.aIAnswer.findMany({
    where: { conversationId: conversation.id },
    orderBy: { turnIndex: "asc" },
  });

  const history: AiMessage[] = answers.map((answer) => ({
    role: answer.role === "USER" ? "user" : "assistant",
    content: answer.content,
  }));

  if (userMessage) {
    await prisma.aIAnswer.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: userMessage,
        inputMode,
        transcriptEdited,
        turnIndex: answers.length,
      },
    });
  }

  const result = await runTurn({ state, history, userMessage });

  // §13 : chaque extraction est conservee avec sa confiance et sa citation.
  // Les rejets sont enregistres aussi — ils constituent la trace qui permet de
  // verifier que le garde-fou fonctionne en production.
  for (const extraction of result.extractions) {
    await prisma.aIProfileExtraction.create({
      data: {
        conversationId: conversation.id,
        targetModel: extraction.spec.model,
        field: extraction.spec.field,
        valueJson: JSON.stringify({ key: extraction.key, value: extraction.value }),
        confidence: extraction.confidence,
        sourceQuote: extraction.sourceQuote || null,
        status: extraction.status,
      },
    });
  }

  await prisma.aIAnswer.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: result.assistantMessage,
      turnIndex: answers.length + (userMessage ? 1 : 0),
    },
  });

  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: {
      state: JSON.stringify(result.state),
      turnCount: result.state.turnIndex,
      completedAt: result.state.done ? new Date() : null,
    },
  });

  return {
    conversationId: conversation.id,
    assistantMessage: result.assistantMessage,
    quickReplies: result.quickReplies,
    progress: result.progress,
    done: result.state.done,
    understood: result.extractions
      .filter((extraction) => extraction.status !== "REJECTED")
      .map((extraction) => ({
        key: extraction.key,
        label: extraction.spec.labelFr,
        value: humanize(extraction.key, extraction.value),
        needsConfirmation: extraction.status === "NEEDS_CONFIRMATION",
      })),
    usedFallback: result.state.usedFallback,
  };
}

/** §14 : apercu complet avant validation. */
export async function buildOnboardingPreview(userId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { userId, purpose: "ONBOARDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) return { rows: [], generated: null };

  const extractions = await prisma.aIProfileExtraction.findMany({
    where: { conversationId: conversation.id, status: { not: "REJECTED" } },
    orderBy: { createdAt: "asc" },
  });

  // Derniere valeur connue par cle.
  const byKey = new Map<string, { value: unknown; status: string }>();
  for (const extraction of extractions) {
    const payload = JSON.parse(extraction.valueJson) as { key: string; value: unknown };
    byKey.set(payload.key, { value: payload.value, status: extraction.status });
  }

  const rows = [...byKey.entries()].map(([key, entry]) => ({
    key,
    label: getFieldSpec(key)?.labelFr ?? key,
    value: humanize(key, entry.value),
    rawValue: entry.value,
    needsConfirmation: entry.status === "NEEDS_CONFIRMATION",
  }));

  const facts: ConfirmedFact[] = [...byKey.entries()].map(([key, entry]) => ({ key, value: entry.value }));
  const generated = await generateProfileSections(facts);

  return { rows, generated, conversationId: conversation.id };
}

export interface ApplyInput {
  userId: string;
  /** Valeurs finales, apres relecture et correction par l'utilisateur (§14). */
  values: Record<string, unknown>;
  gender: "F" | "M";
  seeking: "F" | "M";
  birthDate: string;
  cityId?: string | null;
  bio?: string;
}

/**
 * §14 — application du profil apres validation humaine.
 * Rien n'est ecrit dans le profil avant cet appel.
 */
export async function applyOnboarding(input: ApplyInput): Promise<{ ok: boolean; error?: string }> {
  const values = input.values;
  const birthDate = new Date(input.birthDate);

  if (Number.isNaN(birthDate.getTime())) return { ok: false, error: "Date de naissance invalide." };

  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86_400_000));
  if (age < productRules.minimumAge) {
    return { ok: false, error: `EDENIA est réservé aux personnes de ${productRules.minimumAge} ans et plus.` };
  }
  if (age > productRules.maximumAge) return { ok: false, error: "Date de naissance invalide." };

  const str = (key: string): string | null => {
    const value = values[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const num = (key: string): number | null => {
    const value = values[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const bool = (key: string): boolean => values[key] === true;

  const city = input.cityId
    ? await prisma.city.findUnique({ where: { id: input.cityId }, select: { id: true, regionId: true, countryCode: true } })
    : null;

  const firstName = str("Profile.firstName");
  if (!firstName) return { ok: false, error: "Le prénom est requis." };

  await prisma.profile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      firstName,
      birthDate,
      gender: input.gender,
      seeking: input.seeking,
      bio: input.bio ?? null,
      profession: str("Profile.profession"),
      education: str("Profile.education"),
      maritalStatus: str("Profile.maritalStatus") ?? "SINGLE",
      hasChildren: bool("Profile.hasChildren"),
      languages: JSON.stringify(["Français"]),
      countryCode: city?.countryCode ?? str("Profile.countryCode"),
      regionId: city?.regionId ?? null,
      cityId: city?.id ?? null,
      completeness: 70,
    },
    update: {
      firstName,
      birthDate,
      gender: input.gender,
      seeking: input.seeking,
      bio: input.bio ?? undefined,
      profession: str("Profile.profession"),
      education: str("Profile.education"),
      maritalStatus: str("Profile.maritalStatus") ?? "SINGLE",
      hasChildren: bool("Profile.hasChildren"),
      countryCode: city?.countryCode ?? str("Profile.countryCode"),
      regionId: city?.regionId ?? undefined,
      cityId: city?.id ?? undefined,
    },
  });

  // C6 : la collecte de donnees religieuses exige un consentement dedie.
  const hasFaithData =
    str("FaithProfile.denomination") || str("FaithProfile.commitmentLevel") || num("FaithProfile.prayerImportance");

  if (hasFaithData) {
    await prisma.consent.create({
      data: { userId: input.userId, purpose: "FAITH_PROFILE", granted: true, version: "2026-01" },
    });

    await prisma.faithProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        denomination: str("FaithProfile.denomination"),
        commitmentLevel: str("FaithProfile.commitmentLevel"),
        attendance: str("FaithProfile.attendance"),
        prayerImportance: num("FaithProfile.prayerImportance"),
        bibleReading: str("FaithProfile.bibleReading"),
        churchNameRaw: str("FaithProfile.churchNameRaw"),
        faithInCouple: str("FaithProfile.faithInCouple"),
        visibility: JSON.stringify({ faith: "PUBLIC" }),
      },
      update: {
        denomination: str("FaithProfile.denomination"),
        commitmentLevel: str("FaithProfile.commitmentLevel"),
        attendance: str("FaithProfile.attendance"),
        prayerImportance: num("FaithProfile.prayerImportance"),
        bibleReading: str("FaithProfile.bibleReading"),
        churchNameRaw: str("FaithProfile.churchNameRaw"),
        faithInCouple: str("FaithProfile.faithInCouple"),
      },
    });
  }

  await prisma.marriageVision.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      wantsMarriage: str("MarriageVision.wantsMarriage"),
      timeline: str("MarriageVision.timeline"),
      wantsChildren: str("MarriageVision.wantsChildren"),
      childrenDesired: num("MarriageVision.childrenDesired"),
      financeModel: str("MarriageVision.financeModel"),
      residenceAfter: str("MarriageVision.residenceAfter"),
      expatriation: str("MarriageVision.expatriation"),
      visibility: JSON.stringify({ marriage: "PUBLIC" }),
    },
    update: {
      wantsMarriage: str("MarriageVision.wantsMarriage"),
      timeline: str("MarriageVision.timeline"),
      wantsChildren: str("MarriageVision.wantsChildren"),
      childrenDesired: num("MarriageVision.childrenDesired"),
      financeModel: str("MarriageVision.financeModel"),
      residenceAfter: str("MarriageVision.residenceAfter"),
      expatriation: str("MarriageVision.expatriation"),
    },
  });

  await prisma.familyPreferences.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      extendedFamilySupport: str("FamilyPreferences.extendedFamilySupport"),
      traditionsImportance: num("FamilyPreferences.traditionsImportance"),
    },
    update: {
      extendedFamilySupport: str("FamilyPreferences.extendedFamilySupport"),
      traditionsImportance: num("FamilyPreferences.traditionsImportance"),
    },
  });

  const interests = Array.isArray(values["Lifestyle.interests"]) ? (values["Lifestyle.interests"] as string[]) : [];
  await prisma.lifestyle.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      interests: JSON.stringify(interests),
      socialStyle: str("Lifestyle.socialStyle"),
    },
    update: { interests: JSON.stringify(interests), socialStyle: str("Lifestyle.socialStyle") },
  });

  await prisma.preferences.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      ageMin: Math.max(productRules.minimumAge, age - 8),
      ageMax: Math.min(productRules.maximumAge, age + 8),
      scope: "COUNTRY",
    },
    update: {},
  });

  await prisma.aIConversation.updateMany({
    where: { userId: input.userId, purpose: "ONBOARDING", completedAt: null },
    data: { completedAt: new Date() },
  });

  await prisma.aIProfileExtraction.updateMany({
    where: { conversation: { userId: input.userId }, status: { not: "REJECTED" } },
    data: { status: "APPLIED" },
  });

  return { ok: true };
}

/** §14 : publication explicite, jamais automatique. */
export async function publishProfile(userId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, error: "Profil introuvable." };
  if (!profile.firstName || !profile.cityId) {
    return { ok: false, error: "Complétez au moins votre prénom et votre ville avant de publier." };
  }

  await prisma.profile.update({
    where: { userId },
    data: { isPublished: true, publishedAt: new Date(), completeness: computeCompleteness(profile) },
  });
  return { ok: true };
}

function computeCompleteness(profile: { bio: string | null; profession: string | null; education: string | null }): number {
  let score = 50;
  if (profile.bio) score += 20;
  if (profile.profession) score += 15;
  if (profile.education) score += 15;
  return Math.min(100, score);
}
