import { getStorageProvider } from "@/lib/storage/photos";

/**
 * Service des fichiers stockés.
 *
 * Les photos vivent hors de `public/` : elles sont écrites après le build, et
 * les servir par une route permettra d'y appliquer un contrôle d'accès le jour
 * où certaines photos seront réservées aux matchs.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await context.params;
  const storageKey = key.join("/");

  const data = await getStorageProvider().get(storageKey);
  if (!data) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "image/webp",
      // Le nom de fichier contient un UUID : le contenu ne change jamais.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
