import { prisma } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { monetizationMode } from "@/lib/config/monetization";

/**
 * §22 — reglages modifiables depuis le back-office.
 *
 * Frontiere assumee entre deux natures de configuration :
 *
 *  - **Ce qui vit en base** : les interrupteurs d'exploitation. Fermer les
 *    inscriptions un soir de surcharge, suspendre les dons, afficher un
 *    bandeau de maintenance. Ces decisions se prennent en minutes et ne
 *    doivent pas attendre un deploiement.
 *
 *  - **Ce qui vit dans l'environnement** : le mode de monetisation, les cles
 *    de l'agregateur, le mode d'authentification. Ce sont des decisions de
 *    lancement, elles engagent de l'argent et des contrats ; les mettre a
 *    portee d'un clic dans une interface web serait une faiblesse, pas un
 *    confort. La page de reglages les affiche en lecture seule et dit ou les
 *    changer.
 *
 * Cette frontiere est documentee dans docs/09 et rappelee a l'ecran : un
 * administrateur ne doit jamais se demander pourquoi un reglage resiste.
 */

export type SettingType = "boolean" | "text";

export interface SettingDefinition {
  key: string;
  label: string;
  help: string;
  category: "ACCES" | "SOUTIEN" | "COMMUNICATION";
  type: SettingType;
  defaultValue: string;
  /** Seul un SUPER_ADMIN peut modifier un reglage protege. */
  isProtected: boolean;
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: "access.registration_open",
    label: "Inscriptions ouvertes",
    help: "Fermer les inscriptions n'affecte pas les membres déjà inscrits.",
    category: "ACCES",
    type: "boolean",
    defaultValue: "true",
    isProtected: false,
  },
  {
    key: "access.discovery_open",
    label: "Découverte ouverte",
    help: "Suspendre temporairement la découverte de profils, sans couper les conversations en cours.",
    category: "ACCES",
    type: "boolean",
    defaultValue: "true",
    isProtected: true,
  },
  {
    key: "support.donations_open",
    label: "Dons ouverts",
    help: "Masque le bouton « Soutenir EDENIA » et refuse toute nouvelle transaction de don.",
    category: "SOUTIEN",
    type: "boolean",
    defaultValue: "true",
    isProtected: false,
  },
  {
    key: "comm.banner",
    label: "Bandeau d'information",
    help: "Affiché en haut de l'application pour tous les membres. Vide = aucun bandeau.",
    category: "COMMUNICATION",
    type: "text",
    defaultValue: "",
    isProtected: false,
  },
];

const BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export interface SettingValue extends SettingDefinition {
  value: string;
  /** True si la valeur a ete modifiee depuis le back-office. */
  overridden: boolean;
  updatedAt: Date | null;
}

export async function listSettings(): Promise<SettingValue[]> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((row) => [row.key, row]));

  return SETTING_DEFINITIONS.map((definition) => {
    const row = stored.get(definition.key);
    return {
      ...definition,
      value: row?.value ?? definition.defaultValue,
      overridden: row !== undefined,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function getSetting(key: string): Promise<string> {
  const definition = BY_KEY.get(key);
  if (!definition) throw new Error(`Réglage inconnu : ${key}`);
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? definition.defaultValue;
}

export async function getBooleanSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export async function setSetting(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const definition = BY_KEY.get(key);
  if (!definition) return { ok: false, error: "Réglage inconnu." };

  if (definition.type === "boolean" && value !== "true" && value !== "false") {
    return { ok: false, error: "Valeur attendue : true ou false." };
  }
  const clean = definition.type === "text" ? value.slice(0, 280) : value;

  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value: clean,
      category: definition.category,
      label: definition.label,
      isProtected: definition.isProtected,
      updatedBy,
    },
    update: { value: clean, updatedBy },
  });

  return { ok: true };
}

/**
 * Reglages non modifiables depuis l'interface, affiches pour eviter la
 * question « pourquoi Premium n'apparait pas ? ».
 */
export interface ReadOnlySetting {
  label: string;
  value: string;
  source: string;
  note: string;
}

export function environmentSettings(): ReadOnlySetting[] {
  return [
    {
      label: "Mode de monétisation",
      value: monetizationMode,
      source: "MONETIZATION_MODE",
      note:
        monetizationMode === "premium"
          ? "Les abonnements sont proposés aux membres."
          : "Lancement gratuit : Premium est masqué, son code est conservé. Repasser à « premium » demande un redéploiement — c'est volontaire.",
    },
    {
      label: "Mode d'authentification",
      value: env.AUTH_MODE,
      source: "AUTH_MODE",
      note:
        env.AUTH_MODE === "development"
          ? "Code OTP fixe, aucun SMS envoyé. Refusé au démarrage en production."
          : "Code aléatoire envoyé par la passerelle SMS.",
    },
    {
      label: "Agrégateur de paiement",
      value: env.PAYMENT_PROVIDER,
      source: "PAYMENT_PROVIDER",
      note:
        env.PAYMENT_PROVIDER === "simulated"
          ? "Aucun débit réel. Le webhook est néanmoins signé et vérifié."
          : `GeniusPay, environnement « ${env.GENIUSPAY_ENVIRONMENT} ».`,
    },
    {
      label: "Fournisseur IA",
      value: env.AI_PROVIDER,
      source: "AI_PROVIDER",
      note:
        env.AI_PROVIDER === "rulebased"
          ? "Extracteur déterministe local, sans appel réseau."
          : `Modèle : ${env.ANTHROPIC_MODEL}.`,
    },
    {
      label: "Stockage des photos",
      value: env.STORAGE_PROVIDER,
      source: "STORAGE_PROVIDER",
      note: env.STORAGE_PROVIDER === "local" ? "Disque local du serveur." : "Stockage objet distant.",
    },
  ];
}
