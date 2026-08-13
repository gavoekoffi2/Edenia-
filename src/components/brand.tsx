import Link from "next/link";

/**
 * Identite visuelle. §44 : « Eviter les croix partout, les gros coeurs rouges ».
 * Le logotype est une marque de mot avec une seule marque graphique discrete —
 * un arc, evoquant l'alliance et le foyer, lisible a 20 px.
 */
export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" role="presentation">
        <circle cx="16" cy="16" r="15" fill="var(--color-verd-500)" />
        <path
          d="M9 20.5c0-4.6 3.1-8 7-8s7 3.4 7 8"
          fill="none"
          stroke="var(--color-gold-400)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="10.5" r="2.1" fill="var(--color-clay-300)" />
      </svg>
      {withWordmark && (
        <span className="e-display text-[1.0625rem] tracking-[0.14em] uppercase">EDENIA</span>
      )}
    </span>
  );
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="EDENIA — accueil" className="inline-flex">
      <Logo />
    </Link>
  );
}

export const TAGLINE = "Des rencontres guidées par la foi.";
export const PROMISE = "Ta foi. Tes valeurs. Ton projet de famille. Une rencontre qui a du sens.";
export const SIGNATURE = "Pensée en Afrique. Conçue pour la foi. Orientée vers le foyer.";
