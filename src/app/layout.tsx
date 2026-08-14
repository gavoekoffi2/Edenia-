import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { TAGLINE } from "@/components/brand";

/**
 * §50 — rendu à la demande, imposé par la CSP à nonce.
 *
 * Une page prérendue au build ne peut pas porter le nonce d'une requête qui
 * n'existe pas encore : ses balises `<script>` arriveraient sans nonce face à
 * un en-tête qui en exige un, et le navigateur les refuserait. Le choix était
 * donc entre des pages statiques avec `'unsafe-inline'` — c'est-à-dire sans
 * protection réelle contre l'injection de script — et des pages rendues à la
 * demande avec une vraie CSP.
 *
 * Sur une plateforme qui manipule des pièces d'identité, le second l'emporte.
 * Le surcoût est un rendu serveur de quelques millisecondes ; il n'ajoute pas
 * un octet sur le réseau, et c'est le réseau qui est le goulot d'étranglement
 * en 3G (§45), pas le processeur du serveur.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "EDENIA — Rencontres chrétiennes en Afrique francophone",
    template: "%s · EDENIA",
  },
  description:
    "EDENIA est la plateforme de rencontres chrétiennes conçue pour les célibataires d'Afrique francophone. " +
    "Profils vérifiés, compatibilité fondée sur la foi, les valeurs et le projet de mariage.",
  applicationName: "EDENIA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "EDENIA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "EDENIA",
    title: "EDENIA — Des rencontres guidées par la foi",
    description: TAGLINE,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#16120f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Notre propre script inline doit porter le nonce de la requete, exactement
  // comme ceux que Next injecte. Sans lui, la CSP le refuserait — et le service
  // worker ne s'enregistrerait jamais.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="fr">
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2"
        >
          Aller au contenu
        </a>
        {children}
        {/* §5 : enregistrement du service worker, sans bloquer le rendu. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
