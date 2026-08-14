import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { recordAdminAction, requireAdmin } from "@/lib/admin/service";
import { fail, handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({
  code: z.string().length(2),
  status: z.enum(["ACTIVE", "TEST", "COMING_SOON", "PAUSED"]),
});

/** §20 — statut éditorial d'un pays. N'ouvre pas les inscriptions à lui seul. */
export const PATCH = handler(async (request) => {
  const admin = await requireAdmin("countries.manage");
  const body = await parseBody(request, schema);

  const country = await prisma.country.findUnique({ where: { code: body.code } });
  if (!country) return fail("Pays inconnu.", 404);

  await prisma.country.update({
    where: { code: body.code },
    data: { status: body.status, isLaunched: body.status === "ACTIVE" },
  });

  await recordAdminAction(admin, {
    action: "COUNTRY_STATUS_CHANGED",
    targetType: "Country",
    targetId: body.code,
    metadata: { from: country.status, to: body.status },
  });

  return ok({ status: body.status });
});
