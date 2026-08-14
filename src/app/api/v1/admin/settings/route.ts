import { z } from "zod";
import { recordAdminAction, requireAdmin } from "@/lib/admin/service";
import { SETTING_DEFINITIONS, setSetting } from "@/lib/settings/service";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().max(280),
});

/** §22 — modification d'un réglage d'exploitation. Toujours tracée. */
export const PATCH = handler(async (request) => {
  const admin = await requireAdmin("settings.write");
  const body = await parseBody(request, schema);

  const definition = SETTING_DEFINITIONS.find((item) => item.key === body.key);
  if (!definition) return fail("Réglage inconnu.", 404);

  // Un réglage protégé ne cède qu'à l'administrateur principal, même si le rôle
  // porte « settings.write ».
  if (definition.isProtected && admin.role !== "SUPER_ADMIN") {
    return fail("Ce réglage est réservé à l'administrateur principal.", 403);
  }

  const result = await setSetting(body.key, body.value, admin.adminId);
  if (!result.ok) return fail(result.error ?? "Modification impossible.", 400);

  await recordAdminAction(admin, {
    action: "SETTING_CHANGED",
    targetType: "Setting",
    targetId: body.key,
    metadata: { value: body.value },
  });

  return ok({ key: body.key, value: body.value });
});
