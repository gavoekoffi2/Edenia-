import Link from "next/link";
import { BrandLink, SIGNATURE, TAGLINE } from "@/components/brand";

const FOOTER_LINKS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: "Découvrir",
    links: [
      { href: "/comment-ca-marche", label: "Comment ça marche" },
      { href: "/pourquoi-edenia", label: "Pourquoi EDENIA" },
      { href: "/edenia-ai", label: "EDENIA AI" },
      { href: "/profils-verifies", label: "Profils vérifiés" },
    ],
  },
  {
    heading: "Communauté",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/evenements", label: "Événements" },
      { href: "/temoignages", label: "Témoignages" },
      { href: "/communaute", label: "Communauté" },
    ],
  },
  {
    heading: "EDENIA",
    links: [
      { href: "/a-propos", label: "À propos" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/soutenir", label: "Soutenir EDENIA" },
      { href: "/securite", label: "Sécurité" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Légal",
    links: [
      { href: "/conditions", label: "Conditions d'utilisation" },
      { href: "/confidentialite", label: "Confidentialité" },
    ],
  },
];



export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
      >
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <BrandLink />
          <nav className="hidden md:flex items-center gap-5 text-sm" aria-label="Navigation principale">
            <Link href="/comment-ca-marche">Comment ça marche</Link>
            <Link href="/profils-verifies">Profils vérifiés</Link>
            <Link href="/edenia-ai">EDENIA AI</Link>
            <Link href="/tarifs">Tarifs</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="e-btn e-btn-ghost">
              Se connecter
            </Link>
            <Link href="/inscription" className="e-btn e-btn-primary">
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <footer className="border-t mt-16" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-1">
              <BrandLink />
              <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
                {TAGLINE}
              </p>
            </div>
            {FOOTER_LINKS.map((group) => (
              <div key={group.heading}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>
                  {group.heading}
                </p>
                <ul className="space-y-2 text-sm">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="mt-10 pt-6 border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs"
            style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
          >
            <p>© {new Date().getFullYear()} EDENIA. {SIGNATURE}</p>
            <p>Réservé aux personnes majeures (18 ans et plus).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
