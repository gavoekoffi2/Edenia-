import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/client";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** §54 : seules les pages publiques sont declarees. Aucun profil n'est indexe. */
const STATIC_PATHS = [
  "", "/comment-ca-marche", "/pourquoi-edenia", "/edenia-ai", "/profils-verifies",
  "/securite", "/tarifs", "/faq", "/blog", "/evenements", "/communaute",
  "/temoignages", "/a-propos", "/contact", "/conditions", "/confidentialite",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await prisma.article
    .findMany({ where: { status: "PUBLISHED" }, select: { slug: true, publishedAt: true } })
    .catch(() => []);

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...articles.map((article) => ({
      url: `${BASE}/blog/${article.slug}`,
      lastModified: article.publishedAt ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
