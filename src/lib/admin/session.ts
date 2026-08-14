import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, isProd } from "@/lib/config/env";

/**
 * §9, §50 — session d'elevation du back-office.
 *
 * Deliberement distincte de la session utilisateur. Se connecter a EDENIA ne
 * suffit pas a ouvrir le back-office : il faut, en plus, prouver son identite
 * d'administrateur avec un mot de passe et un code TOTP. Un telephone
 * deverrouille et laisse sur une table ne donne donc pas acces aux dossiers de
 * verification.
 *
 * Duree courte (8 h, non prolongeable en silence) et empreinte des attributs
 * sensibles : changer de mot de passe, reinitialiser le MFA, changer de role ou
 * desactiver le compte invalide instantanement toutes les sessions ouvertes.
 */

export const ADMIN_COOKIE = "edenia_admin";
const ADMIN_TTL_SECONDS = 60 * 60 * 8;

export interface AdminSessionPayload {
  /** AdminUser.id */
  sub: string;
  /** User.id — doit correspondre a la session utilisateur en cours. */
  uid: string;
  /** Empreinte des attributs sensibles. */
  fp: string;
}

export interface AdminFingerprintSource {
  roleCode: string;
  isActive: boolean;
  passwordSetAt: Date | null;
  mfaEnabledAt: Date | null;
}

export function adminFingerprint(source: AdminFingerprintSource): string {
  return createHash("sha256")
    .update(
      [
        source.roleCode,
        source.isActive ? "1" : "0",
        source.passwordSetAt?.toISOString() ?? "-",
        source.mfaEnabledAt?.toISOString() ?? "-",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

function secret(): Uint8Array {
  // Domaine de signature distinct de la session utilisateur : un jeton de
  // session ne peut pas etre presente comme un jeton d'administration.
  return new TextEncoder().encode(`${env.SESSION_SECRET}:admin`);
}

export async function createAdminToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ uid: payload.uid, fp: payload.fp })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("edenia")
    .setAudience("edenia-admin")
    .setExpirationTime(`${ADMIN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function readAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "edenia",
      audience: "edenia-admin",
    });
    if (!payload.sub || typeof payload.uid !== "string" || typeof payload.fp !== "string") return null;
    return { sub: payload.sub, uid: payload.uid, fp: payload.fp };
  } catch {
    return null;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  secure: isProd,
  // Le cookie n'est envoye que sur les chemins du back-office : il ne circule
  // pas avec les requetes ordinaires de l'application.
  path: "/",
  maxAge: ADMIN_TTL_SECONDS,
} as const;

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, COOKIE_OPTIONS);
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return readAdminToken(token);
}
