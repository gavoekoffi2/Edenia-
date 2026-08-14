import { z } from "zod";
import { startAuth } from "@/lib/auth/service";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { hashIp } from "@/lib/crypto/field";
import { clientIp, fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  channel: z.enum(["PHONE", "EMAIL"]),
  destination: z.string().min(3).max(120),
  countryCode: z.string().length(2).optional(),
});

export const POST = handler(async (request) => {
  const body = await parseBody(request, schema);
  const ip = clientIp(request);

  // Limitation par IP, en plus de la limitation par destination du module OTP.
  // Le seuil vient du preset, qui suit deja le mode (dev/prod).
  const limit = await rateLimit(`otp:req:${hashIp(ip) ?? "anon"}`, LIMITS.otpRequest.limit, LIMITS.otpRequest.windowMs);
  if (!limit.allowed) return fail("Trop de demandes. Réessayez plus tard.", 429);

  const result = await startAuth({
    channel: body.channel,
    rawDestination: body.destination,
    countryCode: body.countryCode,
    ip,
  });

  if (!result.ok) return fail(result.error ?? "Demande impossible.", 400);

  return ok({
    challengeId: result.challengeId,
    maskedDestination: result.maskedDestination,
    devCode: result.devCode,
  });
});
