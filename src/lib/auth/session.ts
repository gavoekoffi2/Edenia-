import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, isProd } from "@/lib/config/env";

/**
 * Sessions (§50).
 *
 * JWT signe, pose en cookie HttpOnly. Le champ `sv` (session version) est
 * compare a `User.sessionVersion` : incrementer la valeur en base revoque
 * instantanement toutes les sessions d'un compte — utile lors d'une suspension
 * (§35) ou d'une recuperation de compte.
 */

export const SESSION_COOKIE = "edenia_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export interface SessionPayload {
  sub: string; // userId
  sv: number; // sessionVersion
  role: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ sv: payload.sv, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("edenia")
    .setAudience("edenia-app")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "edenia",
      audience: "edenia-app",
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      sv: typeof payload.sv === "number" ? payload.sv : 0,
      role: typeof payload.role === "string" ? payload.role : "USER",
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
} as const;

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}

export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/** Lecture depuis un en-tete `Authorization` — prevue pour les clients natifs (V3). */
export async function readSessionFromHeader(header: string | null): Promise<SessionPayload | null> {
  if (!header?.startsWith("Bearer ")) return null;
  return readSessionToken(header.slice(7));
}
