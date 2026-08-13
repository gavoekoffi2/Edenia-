/**
 * §4 et §24 — Referentiel geographique.
 *
 * `launchOrder` traduit la strategie du §4 : on ne lance pas tous les pays en
 * meme temps. La densite de profils dans une zone prime sur la couverture. Le
 * Togo (Lome) est le pilote ; les suivants s'activent en changeant `isLaunched`.
 */

export interface CountrySeed {
  code: string;
  nameFr: string;
  dialCode: string;
  currency: string;
  isLaunched: boolean;
  isAfrican: boolean;
  isFrancophone: boolean;
  launchOrder: number | null;
  regions: RegionSeed[];
}

export interface RegionSeed {
  slug: string;
  nameFr: string;
  cities: CitySeed[];
}

export interface CitySeed {
  slug: string;
  nameFr: string;
  lat: number;
  lng: number;
  population?: number;
}

export const COUNTRIES: CountrySeed[] = [
  {
    code: "TG",
    nameFr: "Togo",
    dialCode: "+228",
    currency: "XOF",
    isLaunched: true,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 1,
    regions: [
      {
        slug: "maritime",
        nameFr: "Maritime",
        cities: [
          { slug: "lome", nameFr: "Lomé", lat: 6.1319, lng: 1.2228, population: 1_570_000 },
          { slug: "tsevie", nameFr: "Tsévié", lat: 6.4264, lng: 1.2131, population: 55_000 },
          { slug: "aneho", nameFr: "Aného", lat: 6.2281, lng: 1.5906, population: 47_000 },
          { slug: "vogan", nameFr: "Vogan", lat: 6.3333, lng: 1.5333, population: 27_000 },
        ],
      },
      {
        slug: "plateaux",
        nameFr: "Plateaux",
        cities: [
          { slug: "kpalime", nameFr: "Kpalimé", lat: 6.9, lng: 0.6333, population: 100_000 },
          { slug: "atakpame", nameFr: "Atakpamé", lat: 7.5333, lng: 1.1333, population: 85_000 },
          { slug: "notse", nameFr: "Notsé", lat: 6.95, lng: 1.1667, population: 30_000 },
        ],
      },
      {
        slug: "centrale",
        nameFr: "Centrale",
        cities: [
          { slug: "sokode", nameFr: "Sokodé", lat: 8.9833, lng: 1.1333, population: 117_000 },
          { slug: "tchamba", nameFr: "Tchamba", lat: 9.0333, lng: 1.4167, population: 26_000 },
        ],
      },
      {
        slug: "kara",
        nameFr: "Kara",
        cities: [
          { slug: "kara", nameFr: "Kara", lat: 9.5511, lng: 1.1861, population: 105_000 },
          { slug: "bassar", nameFr: "Bassar", lat: 9.25, lng: 0.7833, population: 25_000 },
        ],
      },
      {
        slug: "savanes",
        nameFr: "Savanes",
        cities: [
          { slug: "dapaong", nameFr: "Dapaong", lat: 10.8622, lng: 0.2075, population: 58_000 },
          { slug: "mango", nameFr: "Mango", lat: 10.3597, lng: 0.4711, population: 38_000 },
        ],
      },
    ],
  },
  {
    code: "BJ",
    nameFr: "Bénin",
    dialCode: "+229",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 2,
    regions: [
      {
        slug: "littoral",
        nameFr: "Littoral",
        cities: [{ slug: "cotonou", nameFr: "Cotonou", lat: 6.3703, lng: 2.3912, population: 680_000 }],
      },
      {
        slug: "oueme",
        nameFr: "Ouémé",
        cities: [{ slug: "porto-novo", nameFr: "Porto-Novo", lat: 6.4969, lng: 2.6289, population: 264_000 }],
      },
      {
        slug: "borgou",
        nameFr: "Borgou",
        cities: [{ slug: "parakou", nameFr: "Parakou", lat: 9.3372, lng: 2.6303, population: 255_000 }],
      },
    ],
  },
  {
    code: "CI",
    nameFr: "Côte d'Ivoire",
    dialCode: "+225",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 3,
    regions: [
      {
        slug: "abidjan",
        nameFr: "Abidjan",
        cities: [{ slug: "abidjan", nameFr: "Abidjan", lat: 5.36, lng: -4.0083, population: 4_700_000 }],
      },
      {
        slug: "yamoussoukro",
        nameFr: "Yamoussoukro",
        cities: [{ slug: "yamoussoukro", nameFr: "Yamoussoukro", lat: 6.8276, lng: -5.2893, population: 355_000 }],
      },
      {
        slug: "vallee-du-bandama",
        nameFr: "Vallée du Bandama",
        cities: [{ slug: "bouake", nameFr: "Bouaké", lat: 7.6906, lng: -5.0304, population: 830_000 }],
      },
    ],
  },
  {
    code: "CM",
    nameFr: "Cameroun",
    dialCode: "+237",
    currency: "XAF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 4,
    regions: [
      {
        slug: "littoral",
        nameFr: "Littoral",
        cities: [{ slug: "douala", nameFr: "Douala", lat: 4.0511, lng: 9.7679, population: 2_770_000 }],
      },
      {
        slug: "centre",
        nameFr: "Centre",
        cities: [{ slug: "yaounde", nameFr: "Yaoundé", lat: 3.848, lng: 11.5021, population: 2_440_000 }],
      },
    ],
  },
  {
    code: "SN",
    nameFr: "Sénégal",
    dialCode: "+221",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 5,
    regions: [
      {
        slug: "dakar",
        nameFr: "Dakar",
        cities: [{ slug: "dakar", nameFr: "Dakar", lat: 14.6928, lng: -17.4467, population: 1_150_000 }],
      },
      {
        slug: "thies",
        nameFr: "Thiès",
        cities: [{ slug: "thies", nameFr: "Thiès", lat: 14.7886, lng: -16.9246, population: 320_000 }],
      },
    ],
  },
  {
    code: "CD",
    nameFr: "République démocratique du Congo",
    dialCode: "+243",
    currency: "CDF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 6,
    regions: [
      {
        slug: "kinshasa",
        nameFr: "Kinshasa",
        cities: [{ slug: "kinshasa", nameFr: "Kinshasa", lat: -4.4419, lng: 15.2663, population: 14_300_000 }],
      },
      {
        slug: "haut-katanga",
        nameFr: "Haut-Katanga",
        cities: [{ slug: "lubumbashi", nameFr: "Lubumbashi", lat: -11.6876, lng: 27.5026, population: 2_580_000 }],
      },
    ],
  },
  {
    code: "BF",
    nameFr: "Burkina Faso",
    dialCode: "+226",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 7,
    regions: [
      {
        slug: "centre",
        nameFr: "Centre",
        cities: [{ slug: "ouagadougou", nameFr: "Ouagadougou", lat: 12.3714, lng: -1.5197, population: 2_450_000 }],
      },
    ],
  },
  {
    code: "GN",
    nameFr: "Guinée",
    dialCode: "+224",
    currency: "GNF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 8,
    regions: [
      {
        slug: "conakry",
        nameFr: "Conakry",
        cities: [{ slug: "conakry", nameFr: "Conakry", lat: 9.6412, lng: -13.5784, population: 1_660_000 }],
      },
    ],
  },
  {
    code: "CG",
    nameFr: "Congo",
    dialCode: "+242",
    currency: "XAF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 9,
    regions: [
      {
        slug: "brazzaville",
        nameFr: "Brazzaville",
        cities: [{ slug: "brazzaville", nameFr: "Brazzaville", lat: -4.2634, lng: 15.2429, population: 1_830_000 }],
      },
    ],
  },
  {
    code: "GA",
    nameFr: "Gabon",
    dialCode: "+241",
    currency: "XAF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 10,
    regions: [
      {
        slug: "estuaire",
        nameFr: "Estuaire",
        cities: [{ slug: "libreville", nameFr: "Libreville", lat: 0.4162, lng: 9.4673, population: 700_000 }],
      },
    ],
  },
  {
    code: "ML",
    nameFr: "Mali",
    dialCode: "+223",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 11,
    regions: [
      {
        slug: "bamako",
        nameFr: "Bamako",
        cities: [{ slug: "bamako", nameFr: "Bamako", lat: 12.6392, lng: -8.0029, population: 2_710_000 }],
      },
    ],
  },
  {
    code: "NE",
    nameFr: "Niger",
    dialCode: "+227",
    currency: "XOF",
    isLaunched: false,
    isAfrican: true,
    isFrancophone: true,
    launchOrder: 12,
    regions: [
      {
        slug: "niamey",
        nameFr: "Niamey",
        cities: [{ slug: "niamey", nameFr: "Niamey", lat: 13.5127, lng: 2.1128, population: 1_330_000 }],
      },
    ],
  },
  // §23 — la diaspora est une cible explicite, pas un effet de bord.
  {
    code: "FR",
    nameFr: "France",
    dialCode: "+33",
    currency: "EUR",
    isLaunched: false,
    isAfrican: false,
    isFrancophone: true,
    launchOrder: 20,
    regions: [
      {
        slug: "ile-de-france",
        nameFr: "Île-de-France",
        cities: [{ slug: "paris", nameFr: "Paris", lat: 48.8566, lng: 2.3522 }],
      },
      {
        slug: "auvergne-rhone-alpes",
        nameFr: "Auvergne-Rhône-Alpes",
        cities: [{ slug: "lyon", nameFr: "Lyon", lat: 45.764, lng: 4.8357 }],
      },
    ],
  },
  {
    code: "BE",
    nameFr: "Belgique",
    dialCode: "+32",
    currency: "EUR",
    isLaunched: false,
    isAfrican: false,
    isFrancophone: true,
    launchOrder: 21,
    regions: [
      {
        slug: "bruxelles",
        nameFr: "Bruxelles",
        cities: [{ slug: "bruxelles", nameFr: "Bruxelles", lat: 50.8503, lng: 4.3517 }],
      },
    ],
  },
  {
    code: "CA",
    nameFr: "Canada",
    dialCode: "+1",
    currency: "CAD",
    isLaunched: false,
    isAfrican: false,
    isFrancophone: true,
    launchOrder: 22,
    regions: [
      {
        slug: "quebec",
        nameFr: "Québec",
        cities: [{ slug: "montreal", nameFr: "Montréal", lat: 45.5019, lng: -73.5674 }],
      },
    ],
  },
];

export const LAUNCHED_COUNTRIES = COUNTRIES.filter((c) => c.isLaunched).map((c) => c.code);

export const FRANCOPHONE_AFRICA = COUNTRIES.filter((c) => c.isAfrican && c.isFrancophone).map((c) => c.code);

export function countryByCode(code: string): CountrySeed | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

/** §7 : selection du pays au format international, ordonnee par ordre de lancement. */
export function dialCodeOptions(): Array<{ code: string; nameFr: string; dialCode: string; flag: string }> {
  const FLAGS: Record<string, string> = {
    TG: "🇹🇬", BJ: "🇧🇯", CI: "🇨🇮", CM: "🇨🇲", SN: "🇸🇳", CD: "🇨🇩", BF: "🇧🇫",
    GN: "🇬🇳", CG: "🇨🇬", GA: "🇬🇦", ML: "🇲🇱", NE: "🇳🇪", FR: "🇫🇷", BE: "🇧🇪", CA: "🇨🇦",
  };
  return [...COUNTRIES]
    .sort((a, b) => (a.launchOrder ?? 99) - (b.launchOrder ?? 99))
    .map((c) => ({ code: c.code, nameFr: c.nameFr, dialCode: c.dialCode, flag: FLAGS[c.code] ?? "🌍" }));
}
