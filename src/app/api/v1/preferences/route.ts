import { z } from "zod";
import { DEALBREAKER_KEY, SCOPE } from "@/lib/config/enums";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99),
  scope: z.enum(SCOPE),
  openToDiaspora: z.boolean(),
  openToChildren: z.boolean(),
  dealbreakers: z.array(z.enum(DEALBREAKER_KEY)).max(9),
});

export const PUT = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  if (body.ageMin > body.ageMax) return fail("L'âge minimum ne peut pas dépasser l'âge maximum.", 400);

  await prisma.preferences.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      scope: body.scope,
      openToDiaspora: body.openToDiaspora,
      openToChildren: body.openToChildren,
    },
    update: {
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      scope: body.scope,
      openToDiaspora: body.openToDiaspora,
      openToChildren: body.openToChildren,
    },
  });

  // §22 : les critères essentiels sont dérivés du profil de la personne — on ne
  // lui redemande pas de saisir la valeur attendue, on reprend la sienne.
  const [marriage, faith, profile, family] = await Promise.all([
    prisma.marriageVision.findUnique({ where: { userId: user.id } }),
    prisma.faithProfile.findUnique({ where: { userId: user.id } }),
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.familyPreferences.findUnique({ where: { userId: user.id } }),
  ]);

  const derive = (key: string): { operator: string; value: unknown } | null => {
    switch (key) {
      case "WANTS_MARRIAGE":
        return { operator: "IN", value: ["YES", "PROBABLY"] };
      case "WANTS_CHILDREN":
        return marriage?.wantsChildren && marriage.wantsChildren !== "UNDECIDED"
          ? { operator: "EQUALS", value: marriage.wantsChildren }
          : null;
      case "FAITH_PRACTICE":
        return faith?.commitmentLevel ? { operator: "AT_LEAST", value: faith.commitmentLevel } : null;
      case "DENOMINATION":
        return faith?.denomination && faith.denomination !== "PREFER_NOT_SAY"
          ? { operator: "EQUALS", value: faith.denomination }
          : null;
      case "COUNTRY":
        return profile?.countryCode ? { operator: "EQUALS", value: profile.countryCode } : null;
      case "CITY":
        return profile?.cityId ? { operator: "EQUALS", value: profile.cityId } : null;
      case "EXPATRIATION":
        return marriage?.expatriation && marriage.expatriation !== "UNDECIDED"
          ? { operator: "EQUALS", value: marriage.expatriation }
          : null;
      case "FAMILY_VISION":
        return family?.extendedFamilySupport && family.extendedFamilySupport !== "UNDECIDED"
          ? { operator: "EQUALS", value: family.extendedFamilySupport }
          : null;
      case "NO_CHILDREN_ALREADY":
        return { operator: "EQUALS", value: false };
      default:
        return null;
    }
  };

  await prisma.dealbreaker.deleteMany({ where: { userId: user.id } });

  const skipped: string[] = [];
  for (const key of body.dealbreakers) {
    const derived = derive(key);
    if (!derived) {
      // On refuse de fabriquer une valeur attendue que la personne n'a pas
      // exprimée : ce serait exactement l'inverse du §13.
      skipped.push(key);
      continue;
    }
    await prisma.dealbreaker.create({
      data: {
        userId: user.id,
        key,
        operator: derived.operator,
        valueJson: JSON.stringify(derived.value),
      },
    });
  }

  return ok({
    saved: true,
    skipped,
    message:
      skipped.length > 0
        ? "Certains critères n'ont pas pu être activés : complétez d'abord la section correspondante de votre profil."
        : null,
  });
});
