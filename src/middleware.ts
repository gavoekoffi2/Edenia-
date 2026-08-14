import { NextResponse, type NextRequest } from "next/server";

/**
 * §50 — Content-Security-Policy à nonce.
 *
 * Ce qui change par rapport à la version précédente : `script-src` ne contient
 * plus `'unsafe-inline'`. Chaque réponse porte un nonce aléatoire, Next l'ajoute
 * à ses propres scripts d'amorçage, et un script injecté par un tiers — via une
 * faille XSS, une extension, un intermédiaire réseau — n'a aucun moyen de le
 * deviner : le navigateur refuse de l'exécuter.
 *
 * Deux choix assumés :
 *
 *  - `style-src-attr 'unsafe-inline'` reste. Les attributs `style` de React ne
 *    peuvent pas porter de nonce, c'est une limite du standard, pas un oubli.
 *    Le risque résiduel d'un style injecté est sans commune mesure avec celui
 *    d'un script.
 *
 *  - `'strict-dynamic'` accompagne le nonce : un script autorisé peut charger
 *    ses propres dépendances, ce dont Next a besoin pour son découpage de
 *    bundles. Les navigateurs qui l'ignorent retombent sur `'self'`.
 *
 * Coût : la présence d'un middleware rend les pages dynamiques. Sur nos écrans
 * — profils, découverte, back-office — ils l'étaient déjà. Pour les pages
 * éditoriales, le surcoût est un rendu serveur de quelques millisecondes, à
 * comparer au risque d'un `'unsafe-inline'` sur un site qui manipule des
 * pièces d'identité.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Next lit `x-nonce` sur la requête pour l'appliquer à ses scripts.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf les ressources statiques, les images et les préchargements.
     * Un préchargement ne rend pas de HTML : lui attribuer un nonce ne
     * servirait qu'à invalider le cache du routeur.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
