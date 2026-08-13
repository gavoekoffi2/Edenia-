import type { ReactNode } from "react";
import Link from "next/link";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`e-card p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="e-display text-xl">{children}</h2>
      {sub && <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{sub}</p>}
    </div>
  );
}

export function Chip({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "verified" | "gold";
}) {
  const cls = variant === "verified" ? "e-chip e-chip-verified" : variant === "gold" ? "e-chip e-chip-gold" : "e-chip";
  return <span className={cls}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  href,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `e-btn e-btn-${variant}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

/**
 * §21 — le score n'est jamais affiche seul. Ce composant refuse d'exister sans
 * son texte d'accompagnement : la prop `caption` est obligatoire.
 */
export function CompatibilityMeter({
  score,
  caption,
  compact = false,
}: {
  score: number;
  caption: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={compact ? "text-sm font-semibold" : "e-display text-lg"}>{score} %</span>
        {!compact && (
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            indicatif
          </span>
        )}
      </div>
      <div className="e-meter mt-1.5" role="img" aria-label={`Compatibilité ${score} %. ${caption}`}>
        <span style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <p className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }}>
        {caption}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="e-card p-8 text-center">
      <p className="e-display text-lg mb-2">{title}</p>
      <p className="text-sm mb-4" style={{ color: "var(--fg-muted)" }}>
        {body}
      </p>
      {action && (
        <Link href={action.href} className="e-btn e-btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** §34 — bandeau d'avertissement, jamais alarmiste, jamais masquable en un clic. */
export function SafetyNotice({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl p-3 text-sm"
      style={{ background: "var(--color-danger-100)", color: "#7a2b23" }}
      role="note"
    >
      {children}
    </div>
  );
}

export function Avatar({
  firstName,
  url,
  size = 48,
}: {
  firstName: string;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={firstName}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  // §45 : pas de requete reseau pour un placeholder.
  return (
    <span
      aria-hidden="true"
      className="rounded-full inline-flex items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        background: "var(--color-sand-300)",
        color: "var(--color-ink-600)",
        fontSize: size * 0.4,
      }}
    >
      {firstName.charAt(0).toUpperCase()}
    </span>
  );
}
