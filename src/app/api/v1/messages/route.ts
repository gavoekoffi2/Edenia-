import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { LIMITS, rateLimit } from "@/lib/auth/ratelimit";
import { sendMessage } from "@/lib/chat/service";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const payload = await parseBody(request, schema);

  const limit = await rateLimit(`msg:${user.id}`, LIMITS.message.limit, LIMITS.message.windowMs);
  if (!limit.allowed) return fail("Vous envoyez des messages trop rapidement.", 429);

  const result = await sendMessage(user.id, payload.conversationId, payload.body);
  if (!result.ok) return fail(result.error ?? "Envoi impossible.", 400);

  return ok({ messageId: result.messageId, warning: result.warning });
});
