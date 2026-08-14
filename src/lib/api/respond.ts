import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { findPrivateLeaks } from "@/lib/db/serialize";
import { isDev } from "@/lib/config/env";
import { ForbiddenError } from "@/lib/auth/rbac";
import { UnauthorizedError } from "@/lib/auth/current-user";
import { AdminElevationRequired } from "@/lib/admin/service";

/**
 * Reponses HTTP normalisees.
 *
 * `ok()` passe la charge utile au detecteur de fuite avant de l'envoyer : en
 * developpement, une reponse contenant un champ prive echoue bruyamment plutot
 * que de partir en silence (§47, C3).
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  if (isDev) {
    const leaks = findPrivateLeaks(data);
    if (leaks.length > 0) {
      console.error("⚠️  Fuite de données privées dans une réponse API :", leaks);
      return NextResponse.json(
        { error: "Fuite de données privées détectée", leaks },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await request.json().catch(() => {
    throw new BadRequestError("Corps de requête illisible.");
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError(firstIssue(parsed.error));
  }
  return parsed.data;
}

function firstIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Requête invalide.";
  return issue.path.length > 0 ? `${issue.path.join(".")} : ${issue.message}` : issue.message;
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * Enveloppe commune : traduit les erreurs typees en reponses HTTP.
 * Le contexte est generique pour rester compatible avec les routes dynamiques
 * (`handler<{ params: Promise<{ id: string }> }>(...)`).
 */
export function handler<C = unknown>(fn: (request: Request, context: C) => Promise<NextResponse>) {
  return async (request: Request, context: C): Promise<NextResponse> => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof BadRequestError) return fail(error.message, 400);
      if (error instanceof UnauthorizedError) return fail("Authentification requise.", 401);
      if (error instanceof ForbiddenError) return fail("Accès refusé.", 403);
      // Session d'administration absente ou expiree : 401 avec un indice sur
      // la marche a suivre, pour que l'interface propose de se reconnecter au
      // lieu d'afficher une erreur muette.
      if (error instanceof AdminElevationRequired) {
        return fail("Session d'administration expirée. Reconnectez-vous au back-office.", 401, {
          adminElevationRequired: true,
        });
      }
      console.error("Erreur API non gérée", error);
      return fail("Une erreur est survenue. Réessayez.", 500);
    }
  };
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}
