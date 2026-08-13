import { requireUser } from "@/lib/auth/current-user";
import { buildOnboardingPreview } from "@/lib/ai/persistence";
import { handler, ok } from "@/lib/api/respond";

export const GET = handler(async () => {
  const user = await requireUser();
  const preview = await buildOnboardingPreview(user.id);
  return ok(preview);
});
