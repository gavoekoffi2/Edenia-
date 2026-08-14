/**
 * Regles de numerotation par pays.
 *
 * §4 de la demande : le Togo est le marche pilote, mais l'architecture doit
 * rester extensible. Ce tableau est le seul endroit a completer pour ouvrir un
 * nouveau marche — le reste du code lit les regles, ne les code pas en dur.
 *
 * Le comportement de validation est deja celui de la production : un numero
 * refuse ici sera refuse en ligne. Seul l'envoi du SMS est simule en
 * developpement.
 */

export interface PhoneRule {
  countryCode: string;
  dialCode: string;
  /** Longueur du numero national, hors indicatif. */
  nationalLength: number;
  /** Numeros mobiles — les seuls capables de recevoir un OTP. */
  mobilePattern: RegExp;
  /** Numeros valides au sens large (fixes inclus), pour un affichage tolerant. */
  anyPattern: RegExp;
  placeholder: string;
  /** Operateurs, utile pour les libelles Mobile Money (§42). */
  operators: string[];
  hint: string;
}

/**
 * Togo : passage a 8 chiffres en 2014. Les mobiles commencent par 7 (Moov) ou
 * 9 (Togocom / Yas), les fixes par 2. Un OTP ne peut arriver que sur un mobile.
 */
const TOGO: PhoneRule = {
  countryCode: "TG",
  dialCode: "+228",
  nationalLength: 8,
  mobilePattern: /^[79]\d{7}$/,
  anyPattern: /^[279]\d{7}$/,
  placeholder: "90 12 34 56",
  operators: ["Togocom (Yas)", "Moov Africa"],
  hint: "8 chiffres, commençant par 7 ou 9.",
};

export const PHONE_RULES: Record<string, PhoneRule> = {
  TG: TOGO,
  // Marches suivants (§4) : desactives cote experience tant que le pays n'est
  // pas lance, mais les regles sont deja la pour eviter une reecriture.
  BJ: {
    countryCode: "BJ",
    dialCode: "+229",
    nationalLength: 10,
    mobilePattern: /^01(4[0-9]|5[0-9]|6[0-9]|9[0-9])\d{6}$/,
    anyPattern: /^\d{8,10}$/,
    placeholder: "01 96 12 34 56",
    operators: ["MTN Bénin", "Moov Africa"],
    hint: "10 chiffres depuis la renumérotation de 2024.",
  },
  CI: {
    countryCode: "CI",
    dialCode: "+225",
    nationalLength: 10,
    mobilePattern: /^(01|05|07)\d{8}$/,
    anyPattern: /^\d{8,10}$/,
    placeholder: "07 12 34 56 78",
    operators: ["Orange", "MTN", "Moov"],
    hint: "10 chiffres, commençant par 01, 05 ou 07.",
  },
  CM: {
    countryCode: "CM",
    dialCode: "+237",
    nationalLength: 9,
    mobilePattern: /^6\d{8}$/,
    anyPattern: /^[26]\d{8}$/,
    placeholder: "6 71 23 45 67",
    operators: ["MTN", "Orange"],
    hint: "9 chiffres, commençant par 6.",
  },
  SN: {
    countryCode: "SN",
    dialCode: "+221",
    nationalLength: 9,
    mobilePattern: /^7[0-8]\d{7}$/,
    anyPattern: /^[37]\d{8}$/,
    placeholder: "77 123 45 67",
    operators: ["Orange", "Free", "Expresso"],
    hint: "9 chiffres, commençant par 7.",
  },
  BF: {
    countryCode: "BF",
    dialCode: "+226",
    nationalLength: 8,
    mobilePattern: /^[05-7]\d{7}$/,
    anyPattern: /^[02-7]\d{7}$/,
    placeholder: "70 12 34 56",
    operators: ["Orange", "Moov Africa", "Telecel"],
    hint: "8 chiffres.",
  },
  GN: {
    countryCode: "GN",
    dialCode: "+224",
    nationalLength: 9,
    mobilePattern: /^6[0-9]\d{7}$/,
    anyPattern: /^[36]\d{8}$/,
    placeholder: "622 12 34 56",
    operators: ["Orange", "MTN"],
    hint: "9 chiffres, commençant par 6.",
  },
  ML: {
    countryCode: "ML",
    dialCode: "+223",
    nationalLength: 8,
    mobilePattern: /^[5-9]\d{7}$/,
    anyPattern: /^[2-9]\d{7}$/,
    placeholder: "76 12 34 56",
    operators: ["Orange", "Moov Africa"],
    hint: "8 chiffres.",
  },
  NE: {
    countryCode: "NE",
    dialCode: "+227",
    nationalLength: 8,
    mobilePattern: /^[89]\d{7}$/,
    anyPattern: /^[289]\d{7}$/,
    placeholder: "90 12 34 56",
    operators: ["Airtel", "Moov Africa", "Zamani"],
    hint: "8 chiffres, commençant par 8 ou 9.",
  },
  GA: {
    countryCode: "GA",
    dialCode: "+241",
    nationalLength: 8,
    mobilePattern: /^0?[567]\d{6}$/,
    anyPattern: /^\d{7,8}$/,
    placeholder: "06 12 34 56",
    operators: ["Airtel", "Moov Africa"],
    hint: "8 chiffres.",
  },
  CG: {
    countryCode: "CG",
    dialCode: "+242",
    nationalLength: 9,
    mobilePattern: /^0[456]\d{7}$/,
    anyPattern: /^0?\d{8}$/,
    placeholder: "06 123 45 67",
    operators: ["MTN", "Airtel"],
    hint: "9 chiffres, commençant par 04, 05 ou 06.",
  },
  CD: {
    countryCode: "CD",
    dialCode: "+243",
    nationalLength: 9,
    mobilePattern: /^[89]\d{8}$/,
    anyPattern: /^[89]\d{8}$/,
    placeholder: "81 234 56 78",
    operators: ["Vodacom", "Orange", "Airtel", "Africell"],
    hint: "9 chiffres, commençant par 8 ou 9.",
  },
  TD: {
    countryCode: "TD",
    dialCode: "+235",
    nationalLength: 8,
    mobilePattern: /^[679]\d{7}$/,
    anyPattern: /^[2679]\d{7}$/,
    placeholder: "66 12 34 56",
    operators: ["Airtel", "Moov Africa"],
    hint: "8 chiffres.",
  },
  CF: {
    countryCode: "CF",
    dialCode: "+236",
    nationalLength: 8,
    mobilePattern: /^7[0-7]\d{6}$/,
    anyPattern: /^[27]\d{7}$/,
    placeholder: "70 12 34 56",
    operators: ["Orange", "Telecel", "Moov Africa"],
    hint: "8 chiffres, commençant par 7.",
  },
};

export function phoneRuleFor(countryCode: string): PhoneRule | undefined {
  return PHONE_RULES[countryCode.toUpperCase()];
}

export type PhoneValidation =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: string };

/**
 * Normalise et valide un numero saisi.
 *
 * Accepte la saisie locale (« 90 12 34 56 »), le format international
 * (« +228 90 12 34 56 »), le prefixe « 00 » et les zeros de tete — refuser ces
 * variantes serait une friction inutile (§60), et c'est ainsi que les numeros
 * sont ecrits au quotidien.
 */
export function validatePhone(raw: string, countryCode: string): PhoneValidation {
  const rule = phoneRuleFor(countryCode);
  if (!rule) return { ok: false, reason: "Ce pays n'est pas encore pris en charge." };

  const cleaned = raw.replace(/[\s.\-()]/g, "");
  if (!cleaned) return { ok: false, reason: "Saisissez votre numéro." };

  let national: string;

  if (cleaned.startsWith("+")) {
    if (!cleaned.startsWith(rule.dialCode)) {
      return { ok: false, reason: `Ce numéro n'est pas un numéro ${rule.dialCode}.` };
    }
    national = cleaned.slice(rule.dialCode.length);
  } else if (cleaned.startsWith("00")) {
    const withPlus = `+${cleaned.slice(2)}`;
    if (!withPlus.startsWith(rule.dialCode)) {
      return { ok: false, reason: `Ce numéro n'est pas un numéro ${rule.dialCode}.` };
    }
    national = withPlus.slice(rule.dialCode.length);
  } else {
    // Un zero de tete est un usage local, pas une erreur.
    national = cleaned.replace(/^0+(?=\d)/, "");
  }

  if (!/^\d+$/.test(national)) {
    return { ok: false, reason: "Un numéro ne contient que des chiffres." };
  }

  if (national.length !== rule.nationalLength) {
    return {
      ok: false,
      reason: `Un numéro ${rule.countryCode} compte ${rule.nationalLength} chiffres. ${rule.hint}`,
    };
  }

  if (!rule.mobilePattern.test(national)) {
    if (rule.anyPattern.test(national)) {
      return {
        ok: false,
        reason: "Ce numéro ne semble pas être un mobile. Un code de vérification ne peut arriver que sur un mobile.",
      };
    }
    return { ok: false, reason: `Ce numéro ne correspond à aucun opérateur connu. ${rule.hint}` };
  }

  return { ok: true, e164: `${rule.dialCode}${national}`, national };
}

/** Affichage lisible : « +228 90 12 34 56 ». */
export function formatPhone(e164: string): string {
  const rule = Object.values(PHONE_RULES).find((r) => e164.startsWith(r.dialCode));
  if (!rule) return e164;
  const national = e164.slice(rule.dialCode.length);
  const groups = national.match(/\d{2}/g) ?? [national];
  return `${rule.dialCode} ${groups.join(" ")}`;
}
