import { z } from "zod";
import { completeInvitation } from "@/lib/admin/service";
import { clientIp, fail, handler, ok, parseBody } from "@/lib/api/respond";
import { rateLimit } from "@/lib/auth/ratelimit";
import { hashIp } from "@/lib/crypto/field";

/**
 * §9 — finalisation d'un compte interne.
 *
 * Route publique par nécessité : la personne n'a pas encore d'identifiants.
 * Son unique protection est le jeton d'invitation, à usage unique et à durée
 * limitée. La limitation par IP empêche de balayer l'espace des jetons.
 */
const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(1).max(200),
  passwordConfirm: z.string().min(1).max(200),
  totpSecret: z.string().min(16).max(64),
  totpCode: z.string().min(6).max(6),
});

export const POST = handler(async (request) => {
  const ip = clientIp(request);
  const limit = await rateLimit(`admin:setup:${hashIp(ip) ?? "anon"}`, 12, 3_600_000);
  if (!limit.allowed) return fail("Trop de tentatives. Réessayez plus tard.", 429);

  const body = await parseBody(request, schema);
  const result = await completeInvitation(body);

  if (!result.ok) return fail(result.error, 400, result.problems ? { problems: result.problems } : undefined);

  // Les codes de récupération ne sortent qu'ici, une seule fois. La base ne
  // conserve que leurs empreintes : ils ne pourront pas être réaffichés.
  return ok({ recoveryCodes: result.recoveryCodes });
});
