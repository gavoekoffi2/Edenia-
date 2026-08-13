import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/auth/service";
import { pseudonymize } from "@/lib/crypto/field";
import { handler, ok, parseBody } from "@/lib/api/respond";

const schema = z.object({ targetId: z.string().min(1), reason: z.string().max(500).optional() });

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, schema);

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: body.targetId } },
    create: { blockerId: user.id, blockedId: body.targetId, reason: body.reason ?? null },
    update: {},
  });

  // Un blocage ferme aussi la conversation : laisser le fil ouvert reviendrait
  // à ne bloquer qu'à moitié.
  await prisma.match.updateMany({
    where: {
      OR: [
        { userAId: user.id, userBId: body.targetId },
        { userAId: body.targetId, userBId: user.id },
      ],
    },
    data: { status: "ENDED" },
  });

  await audit({
    event: "USER_BLOCKED",
    actorType: "USER",
    actorRef: pseudonymize(user.id),
    targetRef: pseudonymize(body.targetId),
  });

  return ok({ blocked: true });
});
