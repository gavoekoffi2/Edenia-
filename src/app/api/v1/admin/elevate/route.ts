import { z } from "zod";
import { elevate, endElevation } from "@/lib/admin/service";
import { clientIp, fail, handler, ok, parseBody } from "@/lib/api/respond";
import { rateLimit } from "@/lib/auth/ratelimit";
import { hashIp } from "@/lib/crypto/field";

/**
 * §9, §50 — ouverture d'une session d'administration.
 *
 * Deux facteurs exigés en une seule requête : mot de passe et code TOTP (ou
 * code de récupération). Le compte est déjà authentifié par sa session
 * utilisateur — c'est donc un troisième facteur en pratique, mais celui-là ne
 * suffit jamais seul.
 */
const schema = z.object({
  password: z.string().min(1).max(200),
  code: z.string().min(6).max(20),
});

export const POST = handler(async (request) => {
  const ip = clientIp(request);
  const limit = await rateLimit(`admin:elevate:${hashIp(ip) ?? "anon"}`, 20, 900_000);
  if (!limit.allowed) return fail("Trop de tentatives. Réessayez plus tard.", 429);

  const body = await parseBody(request, schema);
  const result = await elevate({
    password: body.password,
    code: body.code,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) return fail(result.error, result.locked ? 423 : 401);

  return ok({ role: result.context.role, recoveryCodesLeft: result.context.recoveryCodesLeft });
});

/** Fin de session d'administration, sans toucher à la session utilisateur. */
export const DELETE = handler(async () => {
  await endElevation();
  return ok({ ended: true });
});
