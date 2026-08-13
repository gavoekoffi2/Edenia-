import { env } from "@/lib/config/env";

/**
 * §46 — Couche de notification multi-canal.
 *
 * Contrainte reelle (C9) : sur iOS, les Web Push n'arrivent que si la PWA a ete
 * ajoutee a l'ecran d'accueil. Le push est donc traite comme un simple
 * transport, avec repli. La boite in-app est la source de verite : elle ne
 * depend d'aucune autorisation ni d'aucun operateur.
 *
 * §46 impose aussi une limite morale : « Ne pas creer artificiellement de
 * fausses notifications pour pousser l'engagement. » Elle est appliquee par
 * `NOTIFIABLE_EVENTS` — un evenement absent de cette liste ne peut pas etre
 * notifie, ce qui interdit d'inventer un « quelqu'un pense a toi ».
 */

export type NotificationKind =
  | "NEW_MATCH"
  | "NEW_MESSAGE"
  | "RECOMMENDATION"
  | "EVENT"
  | "VERIFICATION"
  | "SUBSCRIPTION"
  | "SAFETY";

/** Seuls ces evenements, tous declenches par un fait reel, peuvent notifier. */
export const NOTIFIABLE_EVENTS: Record<NotificationKind, { label: string; realEventRequired: string }> = {
  NEW_MATCH: { label: "Nouveau match", realEventRequired: "Un like reciproque vient d'etre enregistre." },
  NEW_MESSAGE: { label: "Nouveau message", realEventRequired: "Un message a ete envoye." },
  RECOMMENDATION: {
    label: "Profil recommandé",
    realEventRequired: "Un nouveau profil a franchi le seuil de compatibilite, au plus une fois par jour.",
  },
  EVENT: { label: "Événement", realEventRequired: "Un evenement a ete publie dans la ville de l'utilisateur." },
  VERIFICATION: { label: "Vérification", realEventRequired: "Un dossier a change d'etat." },
  SUBSCRIPTION: { label: "Abonnement", realEventRequired: "Un paiement ou une echeance a eu lieu." },
  SAFETY: { label: "Sécurité", realEventRequired: "Un signalement ou une mesure de securite concerne l'utilisateur." },
};

export type Channel = "INAPP" | "PUSH" | "SMS" | "EMAIL";

export interface NotificationPayload {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
}

export interface DeliveryContext {
  hasPushSubscription: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  /** Preferences utilisateur : un canal desactive n'est jamais force. */
  disabledChannels?: Channel[];
}

/**
 * Choix du canal. On ne diffuse pas partout a la fois : un SMS coute de l'argent
 * a EDENIA et de l'attention a l'utilisateur. Un seul canal externe au maximum.
 */
export function selectChannels(kind: NotificationKind, context: DeliveryContext): Channel[] {
  const disabled = new Set(context.disabledChannels ?? []);
  const channels: Channel[] = [];

  // La boite in-app recoit toujours : c'est l'historique.
  channels.push("INAPP");

  const isUrgent = kind === "SAFETY" || kind === "NEW_MATCH" || kind === "VERIFICATION";

  if (context.hasPushSubscription && !disabled.has("PUSH")) {
    channels.push("PUSH");
    return channels;
  }

  // Repli : uniquement pour ce qui merite d'interrompre quelqu'un.
  if (!isUrgent) return channels;

  if (context.emailVerified && !disabled.has("EMAIL")) {
    channels.push("EMAIL");
    return channels;
  }
  if (kind === "SAFETY" && context.phoneVerified && !disabled.has("SMS")) {
    // Le SMS est reserve a la securite : c'est le seul cas qui justifie son cout.
    channels.push("SMS");
  }
  return channels;
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

export interface SmsProvider {
  send(to: string, message: string): Promise<{ ok: boolean; ref?: string; error?: string }>;
}

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<{ ok: boolean; ref?: string; error?: string }>;
}

/** Transport de developpement : ecrit dans la console, n'envoie rien. */
export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.info(`[SMS → ${to}] ${message}`);
    return { ok: true, ref: `console-${Date.now()}` };
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, body: string) {
    console.info(`[EMAIL → ${to}] ${subject}\n${body}`);
    return { ok: true, ref: `console-${Date.now()}` };
  }
}

let smsProvider: SmsProvider | null = null;
let emailProvider: EmailProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (!smsProvider) smsProvider = new ConsoleSmsProvider();
  return smsProvider;
}

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) emailProvider = new ConsoleEmailProvider();
  return emailProvider;
}

/** Gabarits — courts, car un SMS long coute plus cher et se tronque. */
export const TEMPLATES = {
  otpSms: (code: string) =>
    `${code} est votre code EDENIA. Il expire dans 10 minutes. Ne le communiquez à personne.`,
  otpEmailSubject: () => "Votre code de connexion EDENIA",
  otpEmailBody: (code: string) =>
    `Votre code de vérification EDENIA est : ${code}\n\n` +
    `Il expire dans 10 minutes.\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — aucun compte n'a été créé.\n\n` +
    `L'équipe EDENIA\n${env.NEXT_PUBLIC_APP_URL}`,
  newMatch: (firstName: string) => ({
    title: "Nouveau match ❤️",
    body: `Vous et ${firstName} vous êtes likés. Lancez la conversation quand vous voulez.`,
  }),
  newMessage: (firstName: string) => ({
    title: `Message de ${firstName}`,
    body: "Vous avez reçu un nouveau message sur EDENIA.",
  }),
  verificationApproved: () => ({
    title: "Votre profil est vérifié 🛡️",
    body: "Le badge EDENIA apparaît maintenant sur votre profil.",
  }),
  verificationRejected: (reason: string) => ({
    title: "Demande de vérification",
    body: `Votre demande n'a pas pu aboutir : ${reason} Vous pouvez la soumettre à nouveau.`,
  }),
};
