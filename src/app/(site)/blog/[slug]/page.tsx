import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } }).catch(() => null);
  if (!article) return { title: "Article introuvable" };
  return {
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: { title: article.title, description: article.excerpt, type: "article" },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } }).catch(() => null);
  if (!article || article.status !== "PUBLISHED") notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/blog" className="text-sm" style={{ color: "var(--fg-muted)" }}>
        ← Tous les articles
      </Link>
      <h1 className="e-display text-3xl mt-4">{article.title}</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--fg-muted)" }}>
        {article.excerpt}
      </p>
      <div className="e-prose mt-8">
        {article.body.split("\n\n").map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
