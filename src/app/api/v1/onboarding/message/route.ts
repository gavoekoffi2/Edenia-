import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { handleOnboardingTurn } from "@/lib/ai/persistence";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  message: z.string().max(4000).nullable(),
  inputMode: z.enum(["TEXT", "VOICE"]).default("TEXT"),
  transcriptEdited: z.boolean().default(false),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  // Le budget IA est plafonné par utilisateur : un onboarding ne doit pas
  // pouvoir consommer un budget illimité (cf. risque « coût IA », docs/00 §3).
  const limit = await rateLimit(`ai:onboarding:${user.id}`, LIMITS.aiTurn.limit, LIMITS.aiTurn.windowMs);
  if (!limit.allowed) {
    return fail("Vous avez atteint la limite d'échanges pour cette heure. Réessayez un peu plus tard.", 429);
  }

  const result = await handleOnboardingTurn(
    user.id,
    body.message,
    body.inputMode,
    body.transcriptEdited,
  );

  return ok(result);
});
