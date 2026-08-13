import type { RawExtraction } from "../guardrails";
import type {
  AiProvider,
  ExtractionInput,
  GenerateProfileTextInput,
  NextQuestionInput,
  NextQuestionOutput,
} from "../provider";
import { TOPICS, type Topic } from "../schema";

/**
 * Fournisseur IA deterministe, sans reseau.
 *
 * Il remplit trois roles, tous necessaires :
 *  1. **Repli** — si le modele distant est indisponible ou si le budget IA du
 *     §« cout par utilisateur » est atteint, l'onboarding continue. En Afrique de
 *     l'Ouest, une coupure reseau pendant l'inscription ne doit pas faire perdre
 *     le compte.
 *  2. **Developpement et tests** — le parcours complet tourne sans cle API.
 *  3. **Oracle** — il fixe, en clair, ce que « comprendre » veut dire pour EDENIA.
 *     Le fournisseur distant doit produire des extractions de meme forme, et
 *     passe par les memes garde-fous (guardrails.ts).
 *
 * Ce n'est pas un modele de langue : c'est une grammaire d'extraction du francais
 * tel qu'il est ecrit et parle sur les marches cibles.
 */

interface Rule {
  key: string;
  /** Rend une valeur + la citation exacte, ou null. */
  run(text: string): { value: unknown; confidence: number; quote: string } | null;
}

function firstOf(
  text: string,
  entries: Array<{ re: RegExp; value: unknown; confidence: number }>,
): { value: unknown; confidence: number; quote: string } | null {
  for (const { re, value, confidence } of entries) {
    const match = re.exec(text);
    if (match) return { value, confidence, quote: match[0] };
  }
  return null;
}

function capture(
  text: string,
  res: RegExp[],
  confidence: number,
  transform: (raw: string) => unknown = (raw) => raw,
): { value: unknown; confidence: number; quote: string } | null {
  for (const re of res) {
    const match = re.exec(text);
    if (match?.[1]) {
      const value = transform(match[1].trim());
      if (value === null || value === undefined || value === "") continue;
      return { value, confidence, quote: match[0] };
    }
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
};

function toCount(raw: string): number | null {
  const digits = Number.parseInt(raw, 10);
  if (Number.isFinite(digits)) return digits;
  const word = NUMBER_WORDS[raw.toLowerCase()];
  return word ?? null;
}

/** Mots qui suivent « je suis » sans designer un metier. */
const NOT_A_JOB =
  /^(?:chr[ée]tien|chretienne|croyant|catholique|protestant|[ée]vang[ée]lique|pentec[ôo]tiste|c[ée]libataire|mari[ée]|divorc[ée]|veu[fv]|s[ée]par[ée]|engag[ée]|n[ée]e?|tr[èe]s|quelqu|une?\s+(?:femme|homme|personne)|heureu|content|pratiquant|ici|l[àa]|d'accord|ok)/i;

const INTEREST_KEYWORDS = [
  "musique", "lecture", "football", "sport", "voyage", "voyages", "cuisine", "chant",
  "chorale", "danse", "cinéma", "nature", "randonnée", "photographie", "basket",
  "natation", "jardinage", "mode", "technologie", "informatique", "entrepreneuriat",
  "bénévolat", "louange", "théâtre", "écriture", "peinture", "athlétisme", "vélo",
  "podcasts", "séries", "documentaires", "marche", "pêche", "couture", "art",
];

const COUNTRY_BY_NAME: Array<{ re: RegExp; code: string }> = [
  { re: /\b(?:au\s+)?togo\b/i, code: "TG" },
  { re: /\b(?:au\s+)?b[ée]nin\b/i, code: "BJ" },
  { re: /\b(?:en\s+)?c[ôo]te\s+d['’]ivoire\b/i, code: "CI" },
  { re: /\b(?:au\s+)?cameroun\b/i, code: "CM" },
  { re: /\b(?:au\s+)?s[ée]n[ée]gal\b/i, code: "SN" },
  { re: /\b(?:en\s+)?rdc\b|\bcongo[- ]kinshasa\b/i, code: "CD" },
  { re: /\b(?:au\s+)?burkina(?:\s+faso)?\b/i, code: "BF" },
  { re: /\b(?:en\s+)?guin[ée]e\b/i, code: "GN" },
  { re: /\b(?:au\s+)?gabon\b/i, code: "GA" },
  { re: /\b(?:au\s+)?mali\b/i, code: "ML" },
  { re: /\b(?:au\s+)?niger\b/i, code: "NE" },
  { re: /\b(?:en\s+)?france\b/i, code: "FR" },
];

/** Villes du pilote — evite de confondre une ville avec un pays. */
const CITY_TO_COUNTRY: Record<string, string> = {
  lome: "TG", "lomé": "TG", kara: "TG", sokode: "TG", "sokodé": "TG", tsevie: "TG", kpalime: "TG",
  cotonou: "BJ", "porto-novo": "BJ", parakou: "BJ", abomey: "BJ",
  abidjan: "CI", yamoussoukro: "CI", bouake: "CI", "bouaké": "CI",
  douala: "CM", yaounde: "CM", "yaoundé": "CM",
  dakar: "SN", thies: "SN", "thiès": "SN",
  kinshasa: "CD", lubumbashi: "CD", goma: "CD",
  ouagadougou: "BF", "bobo-dioulasso": "BF",
  conakry: "GN", libreville: "GA", bamako: "ML", niamey: "NE",
  paris: "FR", lyon: "FR", marseille: "FR",
};

const RULES: Rule[] = [
  {
    key: "Profile.firstName",
    run: (t) =>
      capture(
        t,
        [
          /je\s+m['’]appelle\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]{1,24})/i,
          /moi\s*,?\s*c['’]est\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]{1,24})/i,
          /mon\s+pr[ée]nom\s*,?\s*(?:c['’]est|est)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]{1,24})/i,
        ],
        0.92,
        (raw) => raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
      ),
  },
  {
    key: "Profile.age",
    run: (t) =>
      capture(t, [/j['’]ai\s+(\d{1,2})\s*ans/i, /\b(\d{2})\s*ans\b/i], 0.9, (raw) => {
        const age = Number.parseInt(raw, 10);
        return Number.isFinite(age) && age >= 18 && age <= 99 ? age : null;
      }),
  },
  {
    key: "Profile.maritalStatus",
    run: (t) =>
      firstOf(t, [
        { re: /(?<!\p{L})divorc[ée]e?(?!\p{L})/iu, value: "DIVORCED", confidence: 0.85 },
        { re: /\bveu(?:f|ve)\b/i, value: "WIDOWED", confidence: 0.85 },
        { re: /(?<!\p{L})s[ée]par[ée]e?(?!\p{L})/iu, value: "SEPARATED", confidence: 0.8 },
        { re: /\bc[ée]libataire\b/i, value: "SINGLE", confidence: 0.88 },
      ]),
  },
  {
    key: "Profile.hasChildren",
    run: (t) =>
      firstOf(t, [
        { re: /je\s+n['’]ai\s+pas\s+(?:encore\s+)?d['’]enfants?/i, value: false, confidence: 0.9 },
        { re: /sans\s+enfants?\b/i, value: false, confidence: 0.8 },
        { re: /j['’]ai\s+(?:un|une|deux|trois|quatre|\d+)\s+enfants?/i, value: true, confidence: 0.9 },
      ]),
  },
  {
    key: "Profile.cityLabel",
    run: (t) =>
      capture(
        t,
        [
          /(?:j['’]habite|je\s+vis|je\s+r[ée]side|je\s+suis\s+bas[ée]e?|install[ée]e?)\s*(?:à|a|au|en|dans)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ -]{2,28}?)(?=\s*(?:,|\.|et\b|depuis\b|je\b|$))/i,
          /\b(?:vis|habite)\s+à\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]{2,28})/i,
        ],
        0.82,
        (raw) => {
          const cleaned = raw.replace(/\s+$/, "");
          // « j'habite au Togo » designe un pays, pas une ville.
          if (COUNTRY_BY_NAME.some((c) => c.re.test(cleaned))) return null;
          return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        },
      ),
  },
  {
    key: "Profile.countryCode",
    run: (t) => {
      for (const { re, code } of COUNTRY_BY_NAME) {
        const match = re.exec(t);
        if (match) return { value: code, confidence: 0.85, quote: match[0] };
      }
      // Deduction par la ville — la citation reste celle reellement prononcee.
      for (const [city, code] of Object.entries(CITY_TO_COUNTRY)) {
        // Lookarounds unicode : `\b` ne fonctionne pas a cote d'une lettre
        // accentuee (« Lomé »), ce qui ferait rater la majorite des villes cibles.
        const re = new RegExp(`(?<!\\p{L})${city.replace(/[-]/g, "[- ]")}(?!\\p{L})`, "iu");
        const match = re.exec(t);
        if (match) return { value: code, confidence: 0.78, quote: match[0] };
      }
      return null;
    },
  },
  {
    key: "Profile.profession",
    run: (t) =>
      capture(
        t,
        [
          /je\s+travaille\s+(?:comme|en\s+tant\s+que)\s+([^.,;!?]{3,44})/i,
          /je\s+travaille\s+dans\s+([^.,;!?]{3,44})/i,
          /je\s+suis\s+((?:un[e]?\s+)?[^.,;!?]{3,44})/i,
        ],
        0.68,
        (raw) => {
          const cleaned = raw.replace(/^une?\s+/i, "").trim();
          if (NOT_A_JOB.test(cleaned)) return null;
          if (cleaned.length < 3) return null;
          return cleaned;
        },
      ),
  },
  {
    key: "Profile.education",
    run: (t) =>
      firstOf(t, [
        { re: /\bdoctorat\b|\bph\.?d\b/i, value: "DOCTORATE", confidence: 0.85 },
        { re: /\bmaster\b|\bma[îi]trise\b|\bbac\s*\+\s*5\b/i, value: "MASTER", confidence: 0.85 },
        { re: /\blicence\b|\bbachelor\b|\bbac\s*\+\s*3\b/i, value: "BACHELOR", confidence: 0.85 },
        { re: /\bbts\b|\bdut\b|formation\s+professionnelle/i, value: "VOCATIONAL", confidence: 0.8 },
        { re: /\bbaccalaur[ée]at\b|\bbac\b|\blyc[ée]e\b/i, value: "SECONDARY", confidence: 0.75 },
      ]),
  },

  // --- Foi -----------------------------------------------------------------
  {
    key: "FaithProfile.denomination",
    run: (t) =>
      firstOf(t, [
        { re: /\bpentec[ôo]tiste\b/i, value: "PENTECOSTAL", confidence: 0.9 },
        { re: /(?<!\p{L})[ée]vang[ée]lique(?!\p{L})/iu, value: "EVANGELICAL", confidence: 0.9 },
        { re: /\bm[ée]thodiste\b/i, value: "METHODIST", confidence: 0.9 },
        { re: /\bbaptiste\b/i, value: "BAPTIST", confidence: 0.9 },
        { re: /\badventiste\b/i, value: "ADVENTIST", confidence: 0.9 },
        { re: /\borthodoxe\b/i, value: "ORTHODOX", confidence: 0.9 },
        { re: /\bcatholique\b/i, value: "CATHOLIC", confidence: 0.9 },
        { re: /\bprotestante?\b/i, value: "PROTESTANT", confidence: 0.85 },
      ]),
  },
  {
    key: "FaithProfile.commitmentLevel",
    run: (t) =>
      firstOf(t, [
        { re: /je\s+sers\b|dans\s+le\s+minist[èe]re|je\s+dirige\s+(?:le|la|un|une)|responsable\s+(?:de|du|des)\s+(?:la\s+)?(?:jeunesse|louange|chorale|groupe)/i, value: "SERVING", confidence: 0.85 },
        { re: /engag[ée]e?\s+dans\s+(?:mon|l['’])\s*[ée]glise|tr[èe]s\s+impliqu[ée]e?/i, value: "COMMITTED", confidence: 0.85 },
        { re: /je\s+vais\s+(?:r[ée]guli[èe]rement|souvent)\s+(?:à\s+l['’][ée]glise|au\s+culte)/i, value: "REGULAR", confidence: 0.75 },
        { re: /de\s+temps\s+en\s+temps|occasionnellement/i, value: "OCCASIONAL", confidence: 0.7 },
      ]),
  },
  {
    key: "FaithProfile.attendance",
    run: (t) =>
      firstOf(t, [
        { re: /plusieurs\s+fois\s+par\s+semaine|deux\s+fois\s+par\s+semaine/i, value: "MULTIPLE_WEEKLY", confidence: 0.88 },
        { re: /tous\s+les\s+dimanches|chaque\s+dimanche|toutes\s+les\s+semaines|chaque\s+semaine/i, value: "WEEKLY", confidence: 0.88 },
        { re: /une\s+fois\s+par\s+mois|chaque\s+mois/i, value: "MONTHLY", confidence: 0.82 },
        { re: /rarement\s+à\s+l['’][ée]glise|rarement\s+au\s+culte/i, value: "RARELY", confidence: 0.75 },
      ]),
  },
  {
    key: "FaithProfile.prayerImportance",
    run: (t) =>
      firstOf(t, [
        { re: /je\s+prie\s+(?:tous\s+les\s+jours|chaque\s+jour|quotidiennement)/i, value: 5, confidence: 0.88 },
        { re: /(?:la\s+)?pri[èe]re\s+(?:est|occupe)\s+(?:une\s+place\s+)?(?:tr[èe]s\s+)?(?:importante|essentielle|centrale)/i, value: 5, confidence: 0.8 },
        { re: /(?:elle\s+est|c['’]est)\s+tr[èe]s\s+importante?\s+pour\s+moi/i, value: 5, confidence: 0.7 },
        { re: /je\s+prie\s+(?:r[ée]guli[èe]rement|souvent)/i, value: 4, confidence: 0.75 },
      ]),
  },
  {
    key: "FaithProfile.bibleReading",
    run: (t) =>
      firstOf(t, [
        { re: /je\s+lis\s+la\s+bible\s+(?:tous\s+les\s+jours|chaque\s+jour|quotidiennement)/i, value: "DAILY", confidence: 0.88 },
        { re: /je\s+lis\s+la\s+bible\s+(?:chaque\s+semaine|toutes\s+les\s+semaines)/i, value: "WEEKLY", confidence: 0.85 },
        { re: /je\s+lis\s+(?:parfois|de\s+temps\s+en\s+temps)\s+la\s+bible/i, value: "SOMETIMES", confidence: 0.75 },
      ]),
  },
  {
    key: "FaithProfile.churchNameRaw",
    run: (t) =>
      capture(
        t,
        [
          /(?:je\s+fr[ée]quente|je\s+vais\s+à)\s+(?:l['’][ée]glise\s+)?([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’ -]{2,40}?)(?=\s*(?:,|\.|et\b|depuis\b|$))/,
          /mon\s+[ée]glise\s*,?\s*(?:c['’]est|est)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ -]{2,40})/i,
        ],
        0.78,
      ),
  },
  {
    key: "FaithProfile.faithInCouple",
    run: (t) => {
      const re =
        /([^.!?]*(?:prier\s+(?:ensemble|à\s+deux)|pri[èe]re\s+(?:à\s+deux|en\s+couple)|servir\s+ensemble|foi\s+(?:au\s+centre|partag[ée]e|commune))[^.!?]*)/i;
      const match = re.exec(t);
      if (!match?.[1]) return null;
      return { value: match[1].trim(), confidence: 0.72, quote: match[0] };
    },
  },

  // --- Mariage -------------------------------------------------------------
  {
    key: "MarriageVision.wantsMarriage",
    run: (t) =>
      firstOf(t, [
        { re: /(?:aboutir|conduire|mener)\s+au\s+mariage|en\s+vue\s+du\s+mariage|je\s+veux\s+me\s+marier|construire\s+un\s+foyer|fonder\s+un\s+foyer/i, value: "YES", confidence: 0.85 },
        { re: /relation\s+s[ée]rieuse/i, value: "PROBABLY", confidence: 0.7 },
      ]),
  },
  {
    key: "MarriageVision.wantsChildren",
    run: (t) =>
      firstOf(t, [
        // §13 : le cas explicitement cite par le cahier des charges. Il passe en premier.
        { re: /je\s+ne\s+sais\s+pas\s+(?:encore\s+)?si\s+je\s+(?:veux|voudrais|souhaite)[^.!?]{0,30}enfants?/i, value: "UNDECIDED", confidence: 0.92 },
        { re: /(?:c['’]est\s+)?[àa]\s+discuter[^.!?]{0,20}enfants?|enfants?[^.!?]{0,20}[àa]\s+discuter/i, value: "UNDECIDED", confidence: 0.8 },
        { re: /je\s+ne\s+(?:veux|souhaite)\s+pas\s+d['’]enfants?/i, value: "NO", confidence: 0.9 },
        { re: /je\s+(?:veux|souhaite|aimerais|d[ée]sire)\s+(?:avoir\s+)?des\s+enfants?/i, value: "YES", confidence: 0.88 },
      ]),
  },
  {
    key: "MarriageVision.childrenDesired",
    run: (t) =>
      capture(
        t,
        [/\b(\d|deux|trois|quatre|cinq|six)\s+enfants?\s+(?:me\s+)?(?:para[îi]t|semble|serait|c['’]est\s+bien|id[ée]al)/i, /(?:j['’]aimerais|je\s+souhaite|je\s+voudrais)\s+(\d|deux|trois|quatre|cinq|six)\s+enfants?/i],
        0.78,
        (raw) => toCount(raw),
      ),
  },
  {
    key: "MarriageVision.timeline",
    run: (t) =>
      firstOf(t, [
        { re: /d['’]ici\s+(?:un\s+an|1\s+an)|dans\s+l['’]ann[ée]e/i, value: "WITHIN_1Y", confidence: 0.8 },
        { re: /d['’]ici\s+deux\s+ans|dans\s+(?:les\s+)?deux\s+ans/i, value: "WITHIN_2Y", confidence: 0.8 },
        { re: /d['’]ici\s+cinq\s+ans|dans\s+(?:les\s+)?cinq\s+ans/i, value: "WITHIN_5Y", confidence: 0.78 },
        { re: /je\s+ne\s+suis\s+pas\s+press[ée]e?|pas\s+de\s+pr[ée]cipitation/i, value: "NO_RUSH", confidence: 0.75 },
      ]),
  },
  {
    key: "MarriageVision.expatriation",
    run: (t) =>
      firstOf(t, [
        { re: /je\s+(?:veux|souhaite|aimerais)\s+(?:partir|vivre)\s+à\s+l['’][ée]tranger|m['’]expatrier/i, value: "WANTED", confidence: 0.85 },
        { re: /ouvert[e]?\s+à\s+(?:partir|l['’][ée]tranger|une\s+expatriation)/i, value: "OPEN", confidence: 0.78 },
        { re: /je\s+(?:pr[ée]f[èe]re|veux)\s+rester\s+(?:au|en|à|ici|dans\s+mon\s+pays)/i, value: "PREFER_STAY", confidence: 0.82 },
        { re: /je\s+ne\s+veux\s+pas\s+(?:partir|quitter\s+mon\s+pays)/i, value: "REFUSED", confidence: 0.85 },
      ]),
  },
  {
    key: "MarriageVision.financeModel",
    run: (t) =>
      firstOf(t, [
        { re: /(?:tout\s+)?mettre\s+en\s+commun|compte\s+commun|caisse\s+commune/i, value: "POOLED", confidence: 0.8 },
        { re: /comptes?\s+s[ée]par[ée]s?|chacun\s+g[èe]re\s+(?:son|ses)/i, value: "SEPARATE", confidence: 0.8 },
        { re: /un\s+peu\s+des\s+deux|partiellement\s+en\s+commun/i, value: "MIXED", confidence: 0.72 },
      ]),
  },
  {
    key: "MarriageVision.residenceAfter",
    run: (t) =>
      firstOf(t, [
        { re: /(?:notre|un)\s+(?:propre\s+)?(?:maison|logement|chez[- ]nous)|vivre\s+seuls?\s+(?:tous\s+les\s+deux)?/i, value: "OWN_HOME", confidence: 0.78 },
        { re: /(?:vivre|habiter)\s+(?:avec|chez)\s+(?:la\s+famille|mes\s+parents|ses\s+parents)/i, value: "WITH_FAMILY", confidence: 0.8 },
      ]),
  },

  // --- Famille -------------------------------------------------------------
  {
    key: "FamilyPreferences.extendedFamilySupport",
    run: (t) =>
      firstOf(t, [
        { re: /(?:aider|soutenir)\s+(?:ma|la)\s+famille[^.!?]{0,30}(?:essentiel|indispensable|obligation)/i, value: "ESSENTIAL", confidence: 0.82 },
        { re: /j['’]aide\s+(?:ma|r[ée]guli[èe]rement\s+ma)\s+famille|je\s+soutiens\s+ma\s+famille/i, value: "IMPORTANT", confidence: 0.78 },
        { re: /(?:de\s+temps\s+en\s+temps|quand\s+je\s+peux)[^.!?]{0,25}famille/i, value: "OCCASIONAL", confidence: 0.7 },
      ]),
  },
  {
    key: "FamilyPreferences.traditionsImportance",
    run: (t) =>
      firstOf(t, [
        { re: /(?:les\s+)?traditions?[^.!?]{0,30}(?:tr[èe]s\s+importantes?|essentielles?)/i, value: 5, confidence: 0.78 },
        { re: /(?:les\s+)?traditions?[^.!?]{0,25}(?:importantes?|comptent)/i, value: 4, confidence: 0.72 },
        { re: /(?:les\s+)?traditions?[^.!?]{0,30}(?:peu\s+important|pas\s+vraiment)/i, value: 2, confidence: 0.72 },
      ]),
  },

  // --- Quotidien -----------------------------------------------------------
  {
    key: "Lifestyle.interests",
    run: (t) => {
      const found: string[] = [];
      let quote = "";
      for (const keyword of INTEREST_KEYWORDS) {
        const re = new RegExp(`(?<!\\p{L})${keyword}(?!\\p{L})`, "iu");
        const match = re.exec(t);
        if (match) {
          found.push(keyword);
          if (!quote) quote = match[0];
        }
      }
      if (found.length === 0) return null;
      return { value: found, confidence: 0.7, quote };
    },
  },
  {
    key: "Lifestyle.socialStyle",
    run: (t) =>
      firstOf(t, [
        { re: /j['’]aime\s+sortir|je\s+sors\s+souvent|tr[èe]s\s+sociable/i, value: "OUTGOING", confidence: 0.75 },
        { re: /je\s+reste\s+(?:souvent\s+)?(?:à\s+la\s+maison|chez\s+moi)|casani[èe]re?/i, value: "HOMEBODY", confidence: 0.75 },
        { re: /un\s+peu\s+des\s+deux|[ée]quilibr[ée]e?/i, value: "BALANCED", confidence: 0.65 },
      ]),
  },
];

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/**
 * §11 — « L'IA ne doit pas poser 40 questions de maniere mecanique. Elle doit
 * adapter les questions aux reponses. » Les relances ci-dessous se declenchent
 * sur ce que la personne vient reellement de dire.
 */
const FOLLOW_UPS: Array<{ trigger: RegExp; question: string; quickReplies?: string[]; consumesTopic?: Topic }> = [
  {
    trigger: /je\s+prie\s+(?:tous\s+les\s+jours|chaque\s+jour)|tr[èe]s\s+importante?\s+pour\s+moi|engag[ée]e?\s+dans\s+(?:mon|l['’])\s*[ée]glise/i,
    question:
      "Et dans ton futur couple, aimerais-tu avoir des moments de prière à deux ?",
    quickReplies: ["Oui, c'est important", "Plutôt chacun de son côté", "Je ne sais pas encore"],
    consumesTopic: "FAITH",
  },
  {
    trigger: /je\s+sers\b|minist[èe]re|chorale|louange|responsable\s+(?:de|du|des)/i,
    question: "Tu sers dans ton église — est-ce que tu souhaiterais servir en couple plus tard ?",
    quickReplies: ["Oui, ensemble", "Chacun son service", "À voir"],
    consumesTopic: "FAITH",
  },
  {
    trigger: /entrepreneur|mon\s+entreprise|je\s+monte\s+(?:un|une)/i,
    question:
      "Entreprendre demande du temps. Comment imagines-tu concilier ça avec une vie de famille ?",
    consumesTopic: "MARRIAGE",
  },
  {
    trigger: /j['’]ai\s+(?:un|une|deux|trois|\d+)\s+enfants?/i,
    question:
      "Merci de le partager. Souhaites-tu que cela apparaisse sur ton profil ? C'est toi qui décides.",
    quickReplies: ["Oui, je l'assume", "Plus tard", "Je préfère en parler en privé"],
  },
  {
    trigger: /je\s+ne\s+sais\s+pas\s+(?:encore\s+)?si/i,
    // §13 : on n'insiste pas, on enregistre « à discuter ».
    question:
      "C'est une réponse tout à fait valable — je note « à discuter » plutôt que d'inventer une réponse à ta place. On passe à la suite ?",
    quickReplies: ["Oui, continuons"],
  },
  {
    trigger: /diaspora|je\s+vis\s+(?:en\s+france|à\s+l['’][ée]tranger|au\s+canada)/i,
    question:
      "Tu vis hors d'Afrique. Envisages-tu une relation avec quelqu'un resté au pays ?",
    quickReplies: ["Oui", "Plutôt sur place", "Ça dépend"],
    consumesTopic: "MARRIAGE",
  },
];

const OPENING =
  "Bonjour 👋 Bienvenue sur EDENIA. Pour commencer simplement, raconte-moi qui tu es et ce que tu recherches ici. " +
  "Tu peux écrire, ou appuyer sur le micro et parler — c'est souvent plus rapide.";

const TOPIC_QUESTIONS: Record<Topic, Array<{ text: string; quickReplies?: string[] }>> = {
  IDENTITY: [
    { text: "Pour bien te présenter : comment t'appelles-tu, et quel âge as-tu ?" },
    {
      text: "Et aujourd'hui, quelle est ta situation ?",
      quickReplies: ["Célibataire", "Divorcé(e)", "Veuf/Veuve", "Séparé(e)"],
    },
  ],
  LOCATION: [
    { text: "Dans quelle ville vis-tu en ce moment ?" },
    {
      text: "Te vois-tu y rester, ou es-tu ouvert(e) à déménager pour construire ton foyer ?",
      quickReplies: ["Je reste ici", "Ouvert(e) à bouger", "Je ne sais pas encore"],
    },
  ],
  WORK: [{ text: "Qu'est-ce que tu fais dans la vie ?" }],
  FAITH: [
    { text: "Quelle place la foi occupe-t-elle dans ta vie ?" },
    {
      text: "À quel rythme participes-tu à la vie de ton église ?",
      quickReplies: ["Chaque dimanche", "Plusieurs fois par semaine", "Une fois par mois", "Rarement"],
    },
  ],
  MARRIAGE: [
    { text: "Qu'est-ce que tu recherches ici — et à quel horizon imagines-tu le mariage ?" },
    {
      text: "Et les enfants, comment vois-tu les choses ?",
      quickReplies: ["J'en souhaite", "Je n'en souhaite pas", "Je ne sais pas encore"],
    },
  ],
  FAMILY: [
    {
      text: "Dans beaucoup de familles, on soutient les proches. Quelle place cela occupera-t-il dans ton foyer ?",
      quickReplies: ["C'est essentiel", "Important", "De temps en temps", "Je ne sais pas encore"],
    },
  ],
  LIFESTYLE: [{ text: "Qu'est-ce que tu aimes faire quand tu as du temps pour toi ?" }],
  EXPECTATIONS: [
    { text: "Dernière chose : chez la personne que tu rencontreras, qu'est-ce qui compte vraiment pour toi ?" },
  ],
};

const CLOSING =
  "Merci pour ta confiance 🙏 J'ai de quoi préparer ton profil. Tu vas pouvoir tout relire et corriger avant publication.";

export class RuleBasedAiProvider implements AiProvider {
  readonly name = "rulebased";
  readonly model = "edenia-fr-rules-v1";

  async nextQuestion(input: NextQuestionInput): Promise<NextQuestionOutput> {
    if (input.turnIndex === 0 && input.messages.length === 0) {
      return { text: OPENING };
    }

    if (input.turnIndex >= input.maxTurns) {
      return { text: CLOSING };
    }

    // §11 : d'abord rebondir sur ce qui vient d'etre dit.
    const last = input.lastUserMessage ?? "";
    for (const followUp of FOLLOW_UPS) {
      if (followUp.trigger.test(last)) {
        return { text: this.personalize(followUp.question, input.firstName), quickReplies: followUp.quickReplies };
      }
    }

    const pool = TOPIC_QUESTIONS[input.topic] ?? [];
    const askedCount = input.covered.filter((t) => t === input.topic).length;
    const question = pool[Math.min(askedCount, pool.length - 1)] ?? pool[0];
    if (!question) return { text: CLOSING };

    return { text: this.personalize(question.text, input.firstName), quickReplies: question.quickReplies };
  }

  private personalize(text: string, firstName?: string | null): string {
    if (!firstName) return text;
    // Une seule accroche prenom sur deux, pour ne pas sonner mecanique.
    return Math.random() < 0.5 ? `${firstName}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
  }

  async extract(input: ExtractionInput): Promise<{ extractions: RawExtraction[] }> {
    const known = new Set(input.knownKeys);
    const extractions: RawExtraction[] = [];

    for (const rule of RULES) {
      if (known.has(rule.key)) continue;
      // On cherche d'abord dans le dernier message (le plus pertinent), puis
      // dans l'ensemble du transcript.
      const hit = rule.run(input.lastUserMessage) ?? rule.run(input.transcript);
      if (!hit) continue;
      extractions.push({
        key: rule.key,
        value: hit.value,
        confidence: hit.confidence,
        sourceQuote: hit.quote,
      });
    }

    return { extractions };
  }

  async generateProfileText(input: GenerateProfileTextInput): Promise<{ text: string }> {
    const facts = input.facts.filter((f) => f.value && f.value.trim().length > 0);
    if (facts.length === 0) {
      return { text: "" };
    }

    const name = input.firstName ?? "";

    switch (input.kind) {
      case "BIO": {
        const parts: string[] = [];
        const get = (label: string) => facts.find((f) => f.label === label)?.value;
        const age = get("Âge");
        const city = get("Ville");
        const job = get("Profession");

        if (name && age) parts.push(`${name}, ${age} ans`);
        else if (name) parts.push(name);
        if (job) parts.push(job.charAt(0).toUpperCase() + job.slice(1));
        if (city) parts.push(`vit à ${city}`);

        const head = parts.join(" · ");
        const faith = get("Place de la foi dans le couple");
        const tail = faith ? ` ${capitalizeSentence(faith)}.` : "";
        return { text: `${head}.${tail}`.trim() };
      }
      case "VALUES": {
        const list = facts.map((f) => `${f.label} : ${f.value}`);
        return { text: list.join("\n") };
      }
      case "MARRIAGE_VISION": {
        const list = facts.map((f) => `• ${f.label} — ${f.value}`);
        return { text: list.join("\n") };
      }
      case "LOOKING_FOR": {
        const list = facts.map((f) => f.value).filter(Boolean);
        return {
          text: list.length > 0 ? `Je recherche : ${list.join(", ")}.` : "",
        };
      }
      default:
        return { text: "" };
    }
  }
}

function capitalizeSentence(text: string): string {
  const trimmed = text.trim().replace(/\.$/, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const ALL_TOPICS: readonly Topic[] = TOPICS;
