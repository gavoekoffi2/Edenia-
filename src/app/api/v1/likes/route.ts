import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { currentTier, sendLike } from "@/lib/discovery/likes";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";
import { getBooleanSetting } from "@/lib/settings/service";

const schema = z.object({
  targetId: z.string().min(1),
  kind: z.enum(["LIKE", "PASS"]).default("LIKE"),
});

export const POST = handler(async (request) => {
  const user = await requireUser();

  // §22 : une pause de la découverte qui laisserait l'API ouverte serait
  // cosmétique. Les conversations existantes, elles, ne sont pas touchées.
  if (!(await getBooleanSetting("access.discovery_open"))) {
    return fail("La découverte est momentanément suspendue. Vos conversations restent accessibles.", 503);
  }

  const body = await parseBody(request, schema);
  const tier = await currentTier(user.id);

  const outcome = await sendLike(user.id, body.targetId, body.kind, tier);

  if (outcome.status === "NOT_ALLOWED") return fail(outcome.reason, 403);
  if (outcome.status === "BLOCKED_LIMIT") {
    return fail(
      `Vous avez utilisé vos ${outcome.limit} likes du jour. Ce plafond existe pour que chacun reçoive une attention gérable.`,
      429,
    );
  }
  return ok(outcome);
});
