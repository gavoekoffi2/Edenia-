import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { handler, ok } from "@/lib/api/respond";

export const POST = handler(async () => {
  const response = ok({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
});
