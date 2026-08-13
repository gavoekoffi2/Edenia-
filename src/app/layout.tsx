import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE } from "@/components/brand";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
