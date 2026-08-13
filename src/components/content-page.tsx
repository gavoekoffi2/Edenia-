import type { ReactNode } from "react";
import Link from "next/link";

export interface ContentBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: string;
}

export function ContentPage({
  kicker,
  title,
  lead,
  blocks,
  cta,
  children,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  blocks?: ContentBlock[];
  cta?: { label: string; href: string };
  children?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {kicker && (
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--color-clay-500)" }}>
          {kicker}
        </p>
      )}
      <h1 className="e-display text-3xl sm:text-4xl">{title}</h1>
      {lead && (
        <p className="mt-4 text-lg" style={{ color: "var(--fg-muted)" }}>
          {lead}
        </p>
      )}

      <div className="e-prose mt-8">
        {blocks?.map((block, index) => (
          <section key={block.heading ?? index}>
            {block.heading && <h2>{block.heading}</h2>}
            {block.paragraphs?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {block.bullets && (
              <ul>
                {block.bullets.map((bullet) => (
                  <li key={bullet.slice(0, 40)}>{bullet}</li>
                ))}
              </ul>
            )}
            {block.callout && (
              <p
                className="rounded-xl p-4 text-sm not-italic"
                style={{ background: "var(--color-sand-200)", color: "var(--color-ink-700)" }}
              >
                {block.callout}
              </p>
            )}
          </section>
        ))}
        {children}
      </div>

      {cta && (
        <div className="mt-10">
          <Link href={cta.href} className="e-btn e-btn-primary">
            {cta.label}
          </Link>
        </div>
      )}
    </article>
  );
}

export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="mt-8 space-y-3">
      {items.map((item) => (
        <details key={item.q} className="e-card p-4">
          <summary className="font-semibold cursor-pointer">{item.q}</summary>
          <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
            {item.a}
          </p>
        </details>
      ))}
      {/* §54 : donnees structurees pour les recherches du type « rencontre chretienne Togo ». */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
