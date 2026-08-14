import type { NextConfig } from "next";

/**
 * §45 : la performance est une contrainte produit, pas un reglage.
 * Cible : First Load JS < 120 kB sur le parcours principal, en 3G.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ["@/components"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), microphone=(self), camera=(self), payment=()" },
          /*
           * La Content-Security-Policy n'est plus ici : elle est posee par
           * `src/middleware.ts`, qui genere un nonce par reponse. Une valeur
           * statique ne pourrait pas en contenir, et devrait donc conserver
           * `'unsafe-inline'`. Les seules reponses qui traversent ce bloc sans
           * passer par le middleware sont des ressources statiques, pour
           * lesquelles la CSP n'a pas d'effet.
           */
        ],
      },
      {
        // §54 : les profils prives ne doivent jamais etre indexes.
        source: "/app/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
