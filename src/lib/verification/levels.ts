import type { VerificationKind } from "@/lib/config/enums";

/**
 * §25 a §30 — Profil verifie EDENIA.
 *
 * Le §25 pose la limite a ne jamais franchir : « Il ne faut jamais promettre une
 * garantie absolue sur la personne. » Chaque niveau dit donc **ce qui a ete
 * controle**, pas ce que la personne vaut. Les libelles ci-dessous sont la
 * formulation officielle, et le code s'interdit d'en produire d'autres.
 */

export const VERIFICATION_LEVELS = [
  "PHONE",
  "EMAIL",
  "IDENTITY",
  "PROFILE",
  "CHURCH",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export interface LevelDescriptor {
  level: VerificationLevel;
  label: string;
  /** Ce que le badge signifie exactement — affiche au clic (§30). */
  meaning: string;
  /** Ce que le badge ne signifie PAS. Toujours affiche avec le precedent. */
  limitation: string;
  icon: string;
  /** Verification humaine requise ? */
  manual: boolean;
}

export const LEVELS: Record<VerificationLevel, LevelDescriptor> = {
  PHONE: {
    level: "PHONE",
    label: "Téléphone vérifié",
    meaning: "Ce numéro de téléphone appartient bien à ce compte.",
    limitation: "Cela ne dit rien de l'identité réelle de la personne.",
    icon: "📱",
    manual: false,
  },
  EMAIL: {
    level: "EMAIL",
    label: "E-mail vérifié",
    meaning: "Cette adresse e-mail a été confirmée par son titulaire.",
    limitation: "Cela ne dit rien de l'identité réelle de la personne.",
    icon: "✉️",
    manual: false,
  },
  IDENTITY: {
    level: "IDENTITY",
    label: "Identité vérifiée",
    meaning:
      "Un document d'identité et un selfie ont été contrôlés par l'équipe EDENIA, et correspondent.",
    limitation:
      "EDENIA ne garantit pas les intentions de cette personne. Restez prudent(e) comme dans toute rencontre.",
    icon: "🪪",
    manual: true,
  },
  PROFILE: {
    level: "PROFILE",
    label: "Profil vérifié",
    meaning:
      "Plusieurs informations déclarées sur ce profil ont été contrôlées une à une par l'équipe EDENIA.",
    limitation: "Les opinions et les projets déclarés restent des déclarations.",
    icon: "🛡️",
    manual: true,
  },
  CHURCH: {
    level: "CHURCH",
    label: "Église vérifiée",
    meaning:
      "Une église partenaire a confirmé, avec l'accord de la personne, qu'elle la connaît comme membre.",
    limitation: "L'église n'a aucun regard sur les choix de cette personne sur EDENIA.",
    icon: "⛪",
    manual: true,
  },
};

export interface VerificationState {
  phoneVerified: boolean;
  emailVerified: boolean;
  identityStatus: string;
  profileStatus: string;
  churchStatus: string;
}

/**
 * §29 — duree de validite d'une verification humaine.
 *
 * 24 mois : c'est l'horizon deja retenu pour l'inactivite (docs/02 §5), et un
 * controle d'identite de plus de deux ans ne dit plus grand-chose de la
 * personne qui se presente aujourd'hui. Un badge accorde une fois pour toutes
 * finit par affirmer quelque chose que personne n'a verifie.
 *
 * L'expiration ne supprime rien : elle repasse le dossier en `EXPIRED`, ce qui
 * retire le badge et permet de redemander une verification — gratuitement,
 * comme toujours (§31).
 */
export const VERIFICATION_VALIDITY_MONTHS = 24;

export function verificationExpiryFrom(decidedAt: Date): Date {
  const expiry = new Date(decidedAt);
  expiry.setMonth(expiry.getMonth() + VERIFICATION_VALIDITY_MONTHS);
  return expiry;
}

/**
 * Un statut n'ouvre un niveau que s'il vaut `APPROVED`. `EXPIRED` ne compte
 * donc pas — c'est la seule chose a savoir, et elle est verifiee par un test.
 */
export function achievedLevels(state: VerificationState): VerificationLevel[] {
  const levels: VerificationLevel[] = [];
  if (state.phoneVerified) levels.push("PHONE");
  if (state.emailVerified) levels.push("EMAIL");
  if (state.identityStatus === "APPROVED") levels.push("IDENTITY");
  if (state.profileStatus === "APPROVED") levels.push("PROFILE");
  if (state.churchStatus === "APPROVED") levels.push("CHURCH");
  return levels;
}

/** §30 : le badge « Profil vérifié EDENIA » exige une verification humaine. */
export function hasEdeniaBadge(state: VerificationState): boolean {
  return achievedLevels(state).some((level) => LEVELS[level].manual);
}

/**
 * Elements que l'equipe controle pour une demande donnee (§27).
 * La liste est explicite : un agent ne decide pas seul de ce qu'il regarde.
 */
export const CHECKLISTS: Record<VerificationKind, Array<{ code: string; label: string; legalNote?: string }>> = {
  IDENTITY: [
    { code: "DOC_VALID", label: "Le document est lisible et non expiré" },
    { code: "DOC_MATCHES_SELFIE", label: "Le visage du selfie correspond au document" },
    { code: "AGE_18", label: "La personne a 18 ans révolus", legalNote: "Contrôle obligatoire, sans exception (C10)." },
    { code: "NAME_MATCHES", label: "Le prénom déclaré correspond au document" },
    { code: "NO_TAMPERING", label: "Aucun signe de retouche du document" },
  ],
  PROFILE: [
    { code: "PHOTOS_AUTHENTIC", label: "Les photos ne sont pas issues d'internet" },
    { code: "PHOTOS_SAME_PERSON", label: "Les photos représentent la même personne" },
    { code: "CITY_PLAUSIBLE", label: "La ville déclarée est cohérente" },
    { code: "PROFESSION_PLAUSIBLE", label: "La profession déclarée est plausible" },
    {
      code: "MARITAL_DECLARED",
      label: "La situation matrimoniale déclarée a été confirmée par la personne",
      legalNote: "Déclaratif : EDENIA n'a pas accès aux registres d'état civil.",
    },
    { code: "NO_DUPLICATE", label: "Aucun compte en double détecté" },
  ],
  CHURCH: [
    { code: "CONSENT_GIVEN", label: "La personne a donné son accord écrit et daté" },
    { code: "CHURCH_IS_PARTNER", label: "L'église est enregistrée comme partenaire" },
    { code: "CONTACT_AUTHORIZED", label: "Le contact est un responsable autorisé de l'église" },
    {
      code: "CLOSED_QUESTION_ONLY",
      label: "Seule la question fermée d'appartenance a été posée",
      legalNote: "§28 + C6 : aucune autre information ne doit être demandée ni consignée.",
    },
  ],
};

/**
 * §26/§27 : la duree de conservation des pieces. Les documents d'identite sont
 * detruits une fois la decision prise — les conserver serait un risque sans
 * contrepartie.
 */
export const DOCUMENT_RETENTION_DAYS = 7;

export interface DecisionInput {
  kind: VerificationKind;
  checkedCodes: string[];
  approve: boolean;
  reason?: string;
}

export interface DecisionOutcome {
  valid: boolean;
  error?: string;
  /** Liste des controles reellement effectues, conservee dans le dossier. */
  checkedItems: string[];
}

/** Une approbation exige que **tous** les points de la liste soient coches. */
export function validateDecision(input: DecisionInput): DecisionOutcome {
  const checklist = CHECKLISTS[input.kind];
  const required = checklist.map((item) => item.code);
  const checked = input.checkedCodes.filter((code) => required.includes(code));

  if (input.approve) {
    const missing = required.filter((code) => !checked.includes(code));
    if (missing.length > 0) {
      return {
        valid: false,
        error: `Impossible d'approuver : ${missing.length} contrôle(s) non validé(s).`,
        checkedItems: checked,
      };
    }
  } else if (!input.reason || input.reason.trim().length < 10) {
    return {
      valid: false,
      error: "Un refus doit être motivé — la personne recevra cette explication.",
      checkedItems: checked,
    };
  }

  return { valid: true, checkedItems: checked };
}

/**
 * §28 — la seule question que EDENIA transmet a une eglise partenaire.
 * Aucune autre formulation n'est autorisee, et rien d'autre n'est demande.
 */
export function churchQuestion(firstName: string, cityLabel: string | null): string {
  const where = cityLabel ? ` à ${cityLabel}` : "";
  return (
    `Bonjour, EDENIA agit à la demande de ${firstName}${where}, qui nous a donné son accord écrit.\n\n` +
    `Question unique : reconnaissez-vous ${firstName} comme une personne que votre église connaît ?\n\n` +
    `Réponse attendue : OUI / NON / NE SAIT PAS.\n\n` +
    `Merci de ne transmettre aucune autre information : nous n'en avons pas besoin et nous ne les conserverions pas. ` +
    `Cette démarche n'engage en rien votre église dans les choix personnels de cette personne.`
  );
}
