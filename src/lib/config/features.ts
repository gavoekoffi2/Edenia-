/**
 * Drapeaux fonctionnels — le cahier des charges etale le produit sur MVP / V2 / V3
 * (§56, §57, §58). Les entites correspondantes existent deja en base pour eviter des
 * migrations douloureuses ; seules les surfaces sont eteintes.
 */
export const features = {
  // MVP (§56)
  authOtp: true,
  aiOnboarding: true,
  voiceOnboarding: true,
  profile: true,
  matching: true,
  likesAndMatches: true,
  chat: true,
  verificationRequest: true,
  premium: true,
  admin: true,
  pwa: true,

  // V2 (§57)
  identityVerificationAdvanced: false,
  churchPartners: false,
  churchVerification: true, // demande possible des le MVP, traitement manuel
  events: false,
  community: false,
  voiceNotes: false,
  video: false, // §32 : « eventuellement plus tard »
  diasporaRail: true,

  // V3 (§58)
  academy: false,
  humanMatchmaking: false,
  speedDating: false,

  // Securite / confort
  dateCheck: false, // §41 : « a terme »
  aiIcebreakers: true, // §33
  aiBioImprove: true, // §40
} as const;

export type FeatureKey = keyof typeof features;

export function isEnabled(key: FeatureKey): boolean {
  return features[key];
}

/**
 * §60 — regles produit inviolables, exprimees comme constantes pour etre
 * referencees (et testees) plutot que redecouvertes a chaque ecran.
 */
export const productRules = {
  /** §10, C10 : 18 ans, sans exception. */
  minimumAge: 18,
  maximumAge: 99,
  /** §60 : un seul canal verifie suffit. */
  requireBothContactChannels: false,
  /** §21 : le score reste indicatif — jamais 100 %. */
  maxDisplayedCompatibility: 97,
  /** §21 : arrondi pour ne pas simuler une precision inexistante. */
  compatibilityRoundingStep: 1,
  /** §31, C2 : la verification n'est jamais un produit payant. */
  verificationIsFree: true,
  /** §34 : le trust score ne sort jamais du back-office. */
  trustScoreIsInternalOnly: true,
  /** C6 : consentement dedie avant toute collecte de donnee religieuse. */
  faithDataRequiresExplicitConsent: true,
  /** Risque n°1 : plafond de likes identique pour tout le monde. */
  dailyLikeLimitFree: 20,
  dailyLikeLimitPremium: 100,
  /** §61 : nombre maximal de champs obligatoires avant d'acceder au produit. */
  maxRequiredFieldsBeforeDiscovery: 6,
} as const;
