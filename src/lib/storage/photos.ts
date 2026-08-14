import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/config/env";

/**
 * Stockage et traitement des photos de profil.
 *
 * §45 : une photo brute de smartphone pese 3 a 6 Mo. La servir telle quelle sur
 * une 3G rendrait la decouverte inutilisable. Chaque image est donc
 * redimensionnee et reencodee en WebP a l'arrivee — le traitement se fait une
 * fois au televersement, jamais a chaque affichage.
 *
 * Le fournisseur est abstrait : passer a un stockage objet (S3, R2) consiste a
 * implementer `StorageProvider`, sans toucher au code appelant.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo en entree
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_PHOTOS_PER_USER = 6;

/** Largeur de rendu maximale : au-dela, l'ecran cible n'en profite pas. */
const TARGET_WIDTH = 1080;
const WEBP_QUALITY = 78;

export interface StoredPhoto {
  storageKey: string;
  width: number;
  height: number;
  bytes: number;
  /** Placeholder minuscule (data URI) affiche pendant le chargement. */
  blurhash: string;
}

export interface StorageProvider {
  readonly kind: string;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Stockage local : les fichiers vivent hors de `public/`, servis par /media. */
export class LocalStorageProvider implements StorageProvider {
  readonly kind = "local";
  private readonly root = path.join(process.cwd(), ".uploads");

  private resolve(key: string): string {
    // Un `key` malveillant ne doit jamais sortir du dossier de stockage.
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.join(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error("Chemin de stockage invalide.");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // Un fichier deja absent n'est pas une erreur.
    }
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    // S3 viendra s'enregistrer ici ; le reste du code n'en saura rien.
    provider = new LocalStorageProvider();
  }
  return provider;
}

export type ProcessResult =
  | { ok: true; photo: StoredPhoto }
  | { ok: false; error: string };

/**
 * Valide, redimensionne, reencode et stocke une image.
 * Les metadonnees EXIF sont supprimees par `sharp` — elles contiennent souvent
 * la position GPS de la prise de vue, ce que le §24 interdit d'exposer.
 */
export async function processAndStore(file: File, userId: string): Promise<ProcessResult> {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return { ok: false, error: "Format non pris en charge. Utilisez une photo JPEG, PNG ou WebP." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Cette photo dépasse 8 Mo. Choisissez-en une plus légère." };
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const image = sharp(input, { failOn: "error" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: "Ce fichier n'est pas une image lisible." };
    }
    if (metadata.width < 200 || metadata.height < 200) {
      return { ok: false, error: "Cette photo est trop petite (200 × 200 pixels minimum)." };
    }

    // `rotate()` sans argument applique l'orientation EXIF puis la supprime :
    // sans cela, les photos prises en portrait s'affichent couchees.
    const pipeline = sharp(input).rotate().resize({
      width: TARGET_WIDTH,
      height: TARGET_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    });

    const output = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });

    // Placeholder de 16 px encode en data URI : quelques centaines d'octets,
    // aucune requete reseau supplementaire (§45).
    const tiny = await sharp(input)
      .rotate()
      .resize({ width: 16, height: 16, fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();

    const key = `photos/${userId}/${randomUUID()}.webp`;
    await getStorageProvider().put(key, output.data);

    return {
      ok: true,
      photo: {
        storageKey: key,
        width: output.info.width,
        height: output.info.height,
        bytes: output.info.size,
        blurhash: `data:image/webp;base64,${tiny.toString("base64")}`,
      },
    };
  } catch {
    return { ok: false, error: "Cette image n'a pas pu être traitée. Réessayez avec une autre photo." };
  }
}

export async function deletePhoto(storageKey: string): Promise<void> {
  await getStorageProvider().delete(storageKey);
}

/**
 * Controle automatique avant publication (M4 de docs/00).
 *
 * Ce qui est fait ici est volontairement limite et honnete : dimensions,
 * format, poids. La detection de nudite, de violence ou d'absence de visage
 * demande un service de vision qui n'est pas branche — les photos partent donc
 * en revue humaine en production plutot que d'etre approuvees a l'aveugle.
 */
export const PHOTO_MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "REVIEW_REQUIRED"] as const;
export type PhotoModerationStatus = (typeof PHOTO_MODERATION_STATUSES)[number];

export const PHOTO_MODERATION_LABEL: Record<PhotoModerationStatus, string> = {
  PENDING: "En attente d'examen",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
  REVIEW_REQUIRED: "Doute — examen humain requis",
};

export interface AutoModerationVerdict {
  status: PhotoModerationStatus;
  reason: string;
}

/**
 * Trois issues, et la distinction entre les deux dernieres compte :
 *
 *  - REJECTED        : un critere objectif n'est pas rempli. Aucun humain n'a
 *                      besoin de regarder une image de 80 pixels de cote.
 *  - REVIEW_REQUIRED : un signal fait douter. La photo passe devant un humain
 *                      **en priorite** — c'est une file distincte, pas la queue
 *                      normale.
 *  - PENDING         : rien de suspect, mais rien de verifie non plus. File
 *                      d'attente ordinaire.
 *
 * Fusionner REVIEW_REQUIRED et PENDING reviendrait a noyer les cas douteux
 * dans le volume, c'est-a-dire a les traiter en dernier.
 */
export function autoModerate(photo: StoredPhoto, options: { devMode: boolean }): AutoModerationVerdict {
  if (photo.width < 200 || photo.height < 200) {
    return { status: "REJECTED", reason: "Image trop petite (moins de 200 px de côté)." };
  }

  const ratio = photo.width / photo.height;
  if (ratio > 3 || ratio < 1 / 3) {
    // Un format extreme cache souvent une capture d'ecran ou un montage.
    return { status: "REVIEW_REQUIRED", reason: "Format inhabituel : capture d'écran ou montage possible." };
  }

  if (photo.bytes < 4_000) {
    // Apres reencodage en WebP, une photo de personne ne descend pas si bas.
    return { status: "REVIEW_REQUIRED", reason: "Image très peu détaillée après réencodage." };
  }

  if (options.devMode) {
    // §9 de la phase pilote : le raccourci est explicite et trace en base, pour
    // qu'on ne puisse pas le confondre avec une vraie moderation.
    return { status: "APPROVED", reason: "Auto-approuvée — mode développement, aucune revue humaine." };
  }

  return { status: "PENDING", reason: "En attente de revue par l'équipe de modération." };
}

export function storageStatus(): { kind: string; note: string } {
  return {
    kind: env.STORAGE_PROVIDER,
    note:
      env.STORAGE_PROVIDER === "local"
        ? "Fichiers stockés sur le disque local (.uploads/), servis par /media."
        : "Stockage objet distant.",
  };
}
