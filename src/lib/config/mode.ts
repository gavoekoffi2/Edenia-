import { env, isProd } from "./env";

/**
 * Mode de fonctionnement des services externes.
 *
 * Principe directeur : le mode developpement **ne desactive aucun controle**.
 * Il rend seulement les services externes inutiles pour tester.
 *
 * Concretement, pour l'authentification : le code OTP devient previsible, mais
 * il est toujours genere, hache avec un sel, compare a temps constant, soumis
 * au compteur de tentatives et a l'expiration. Le chemin de verification est
 * exactement celui de la production — c'est ce qui garantit qu'on ne teste pas
 * un parcours different de celui qui partira en ligne.
 */

export type ServiceMode = "development" | "production";

export const authMode: ServiceMode = env.AUTH_MODE;
export const isDevAuth = authMode === "development";

/**
 * Code OTP fixe en mode developpement. Documente et affiche dans l'interface,
 * jamais silencieux : personne ne doit pouvoir confondre ce comportement avec
 * celui de la production.
 */
export const DEV_OTP_CODE = "228228";

/**
 * Etat des services externes, expose au back-office (§10 de la demande) et
 * utilise pour etiqueter l'interface.
 */
export interface ServiceStatus {
  key: string;
  label: string;
  mode: ServiceMode;
  detail: string;
  /** True si un branchement reel reste a faire avant la beta. */
  pendingRealIntegration: boolean;
}

export function serviceStatuses(): ServiceStatus[] {
  return [
    {
      key: "auth",
      label: "Authentification",
      mode: authMode,
      detail: isDevAuth
        ? `Code OTP fixe (${DEV_OTP_CODE}), aucun SMS envoyé. Vérification, hachage et limitation de débit inchangés.`
        : "OTP aléatoire envoyé par la passerelle SMS configurée.",
      pendingRealIntegration: isDevAuth,
    },
    {
      key: "sms",
      label: "Passerelle SMS",
      mode: env.SMS_PROVIDER === "console" ? "development" : "production",
      detail:
        env.SMS_PROVIDER === "console"
          ? "Aucun SMS réel. Les messages sont journalisés côté serveur."
          : `Fournisseur : ${env.SMS_PROVIDER}.`,
      pendingRealIntegration: env.SMS_PROVIDER === "console",
    },
    {
      key: "email",
      label: "E-mail",
      mode: env.EMAIL_PROVIDER === "console" ? "development" : "production",
      detail:
        env.EMAIL_PROVIDER === "console"
          ? "Aucun e-mail réel. L'e-mail reste facultatif (§8 : un seul canal vérifié suffit)."
          : `Fournisseur : ${env.EMAIL_PROVIDER}.`,
      pendingRealIntegration: env.EMAIL_PROVIDER === "console",
    },
    {
      key: "payments",
      label: "Paiement",
      mode:
        env.PAYMENT_PROVIDER === "simulated" || env.GENIUSPAY_ENVIRONMENT === "sandbox"
          ? "development"
          : "production",
      detail:
        env.PAYMENT_PROVIDER === "simulated"
          ? "Paiement simulé. Aucun débit réel, aucun agrégateur branché. Le webhook est néanmoins signé et traverse le code de production."
          : `GeniusPay — environnement « ${env.GENIUSPAY_ENVIRONMENT} »` +
            (env.GENIUSPAY_ENVIRONMENT === "sandbox" ? ". Transactions simulées par GeniusPay." : ". Transactions réelles."),
      pendingRealIntegration: env.PAYMENT_PROVIDER === "simulated" || env.GENIUSPAY_ENVIRONMENT === "sandbox",
    },
    {
      key: "ai",
      label: "EDENIA AI",
      mode: env.AI_PROVIDER === "rulebased" ? "development" : "production",
      detail:
        env.AI_PROVIDER === "rulebased"
          ? "Extracteur déterministe local. Fonctionnel et testé, sans appel réseau."
          : `Fournisseur : ${env.AI_PROVIDER} (${env.ANTHROPIC_MODEL}).`,
      pendingRealIntegration: false,
    },
    {
      key: "storage",
      label: "Stockage des photos",
      mode: env.STORAGE_PROVIDER === "local" ? "development" : "production",
      detail:
        env.STORAGE_PROVIDER === "local"
          ? "Fichiers écrits sur le disque local, sous public/uploads/."
          : "Stockage objet distant.",
      pendingRealIntegration: env.STORAGE_PROVIDER === "local",
    },
  ];
}

/** True si au moins un service tourne en simulation — pilote le bandeau du back-office. */
export function isAnyServiceSimulated(): boolean {
  return serviceStatuses().some((service) => service.mode === "development");
}

/**
 * §9 de la demande : le mode developpement ne doit jamais se confondre avec la
 * production. En production, ce drapeau est faux et aucun bandeau n'apparait.
 */
export const showDevIndicator = !isProd && isAnyServiceSimulated();

/**
 * Limites adaptees au mode. Le mecanisme de limitation reste actif dans les
 * deux cas — seul le seuil change, pour ne pas bloquer une session de test qui
 * cree une dizaine de comptes d'affilee.
 */
export const authLimits = {
  otpRequestPerHourPerDestination: isDevAuth ? 100 : 3,
  otpRequestPerHourPerIp: isDevAuth ? 300 : 6,
  otpVerifyPerWindow: isDevAuth ? 100 : 10,
} as const;
