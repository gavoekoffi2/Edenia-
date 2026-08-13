import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Articles sur les relations, la préparation au mariage, la communication dans le couple, la famille, " +
    "la spiritualité et la sécurité en ligne.",
  alternates: { canonical: "/blog" },
};

const CATEGORY_LABEL: Record<string, string> = {
  RELATIONS: "Relations",
  MARRIAGE: "Mariage",
  PREPARATION: "Préparation au mariage",
  COMMUNICATION: "Communication",
  FAMILY: "Famille",
  SPIRITUALITY: "Spiritualité",
  SAFETY: "Sécurité",
};

export default async function Page() {
  const articles = await prisma.article
    .findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 30 })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="e-display text-3xl sm:text-4xl">Blog</h1>
      <p className="mt-4" style={{ color: "var(--fg-muted)" }}>
        Ce qui aide vraiment avant, pendant et après une rencontre.
      </p>

      {articles.length === 0 ? (
        <p className="mt-8 text-sm" style={{ color: "var(--fg-muted)" }}>
          Les premiers articles arrivent bientôt.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {articles.map((article) => (
            <Link key={article.id} href={`/blog/${article.slug}`} className="e-card p-5 block">
              <span className="e-chip">{CATEGORY_LABEL[article.category] ?? article.category}</span>
              <h2 className="e-display text-lg mt-2">{article.title}</h2>
              <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                {article.excerpt}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
