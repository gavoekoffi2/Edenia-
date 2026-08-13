import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { applyOnboarding, publishProfile } from "@/lib/ai/persistence";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  // §14 : ce sont les valeurs relues et corrigées par l'utilisateur qui font foi,
  // jamais celles extraites par l'IA.
  values: z.record(z.string(), z.unknown()),
  gender: z.enum(["F", "M"]),
  seeking: z.enum(["F", "M"]),
  birthDate: z.string().min(8),
  cityId: z.string().nullable().optional(),
  bio: z.string().max(2000).optional(),
  publish: z.boolean().default(false),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  const applied = await applyOnboarding({
    userId: user.id,
    values: body.values,
    gender: body.gender,
    seeking: body.seeking,
    birthDate: body.birthDate,
    cityId: body.cityId ?? null,
    bio: body.bio,
  });

  if (!applied.ok) return fail(applied.error ?? "Enregistrement impossible.", 400);

  if (body.publish) {
    const published = await publishProfile(user.id);
    if (!published.ok) return fail(published.error ?? "Publication impossible.", 400);
  }

  return ok({ applied: true, published: body.publish, next: "/app/decouvrir" });
});
