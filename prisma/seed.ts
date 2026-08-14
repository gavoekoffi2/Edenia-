import { PrismaClient } from "@prisma/client";
import { COUNTRIES } from "../src/lib/geo/data";
import { PLAN_OFFERS } from "../src/lib/premium/entitlements";
import { permissionsFor, ROLES } from "../src/lib/auth/rbac";

/**
 * Jeu de donnees de developpement.
 *
 * Il est volontairement centre sur Lome (§4, phase pilote) : sans densite locale,
 * la decouverte renvoie des resultats vides et on ne peut rien evaluer.
 */

const prisma = new PrismaClient();

const ROLE_LABELS_FR: Record<string, string> = {
  USER: "Membre",
  SUPPORT: "Support",
  ANALYST: "Analyste",
  VERIFICATION_AGENT: "Agent de vérification",
  MODERATOR: "Modérateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Administrateur principal",
};

async function seedGeography() {
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        nameFr: country.nameFr,
        dialCode: country.dialCode,
        currency: country.currency,
        isLaunched: country.isLaunched,
        isAfrican: country.isAfrican,
        isFrancophone: country.isFrancophone,
        launchOrder: country.launchOrder,
      },
      update: { isLaunched: country.isLaunched },
    });

    for (const region of country.regions) {
      const regionRow = await prisma.region.upsert({
        where: { countryCode_slug: { countryCode: country.code, slug: region.slug } },
        create: { countryCode: country.code, slug: region.slug, nameFr: region.nameFr },
        update: { nameFr: region.nameFr },
      });

      for (const city of region.cities) {
        await prisma.city.upsert({
          where: { countryCode_slug: { countryCode: country.code, slug: city.slug } },
          create: {
            countryCode: country.code,
            regionId: regionRow.id,
            slug: city.slug,
            nameFr: city.nameFr,
            lat: city.lat,
            lng: city.lng,
            population: city.population ?? null,
          },
          update: { regionId: regionRow.id, lat: city.lat, lng: city.lng },
        });
      }
    }
  }
}

async function seedRolesAndPlans() {
  for (const role of ROLES) {
    await prisma.adminRole.upsert({
      where: { code: role },
      create: {
        code: role,
        nameFr: ROLE_LABELS_FR[role] ?? role,
        permissionsJson: JSON.stringify(permissionsFor(role)),
      },
      update: { permissionsJson: JSON.stringify(permissionsFor(role)) },
    });
  }

  await prisma.plan.upsert({
    where: { code: "FREE" },
    create: {
      code: "FREE",
      nameFr: "Gratuit",
      priceCents: 0,
      currency: "XOF",
      durationDays: 36500,
      featuresJson: JSON.stringify([
        "Inscription et profil",
        "Matching de base",
        "Likes et matchs",
        "Chat après match",
        "Demande de vérification",
      ]),
    },
    update: {},
  });

  for (const offer of PLAN_OFFERS) {
    await prisma.plan.upsert({
      where: { code: offer.code },
      create: {
        code: offer.code,
        nameFr: offer.nameFr,
        priceCents: offer.priceCents,
        currency: offer.currency,
        durationDays: offer.durationDays,
        // §14 : reconduction possible quand l'agregateur la supportera. Aucune
        // offre n'est reconduite automatiquement sans accord explicite.
        isRecurring: false,
        featuresJson: JSON.stringify([
          "Filtre « profils vérifiés »",
          "Filtres avancés",
          "Compatibilité détaillée",
          "Voir qui vous a liké",
          "Mode diaspora complet",
          "Aide IA pour la bio et les réponses",
        ]),
      },
      update: { priceCents: offer.priceCents },
    });
  }
}

async function seedChurches() {
  const lome = await prisma.city.findFirst({ where: { countryCode: "TG", slug: "lome" } });
  if (!lome) return;

  const churches = [
    { name: "Église Évangélique Presbytérienne du Togo — Bè", denomination: "PROTESTANT", slug: "eept-be" },
    { name: "Assemblées de Dieu — Tokoin", denomination: "PENTECOSTAL", slug: "adt-tokoin" },
    { name: "Paroisse Saint-Augustin de Lomé", denomination: "CATHOLIC", slug: "st-augustin-lome" },
    { name: "Église Méthodiste du Togo — Agbalépédogan", denomination: "METHODIST", slug: "emt-agbalepedogan" },
    { name: "Église Baptiste de Nyékonakpoè", denomination: "BAPTIST", slug: "baptiste-nyekonakpoe" },
  ];

  for (const church of churches) {
    await prisma.church.upsert({
      where: { slug: church.slug },
      create: { ...church, countryCode: "TG", cityId: lome.id, isVerified: true },
      update: {},
    });
  }
}

interface ProfileSeed {
  phone: string;
  firstName: string;
  gender: "F" | "M";
  seeking: "F" | "M";
  age: number;
  citySlug: string;
  countryCode: string;
  profession: string;
  education: string;
  bio: string;
  denomination: string;
  commitmentLevel: string;
  attendance: string;
  prayerImportance: number;
  bibleReading: string;
  faithInCouple: string;
  churchSlug?: string;
  wantsMarriage: string;
  timeline: string;
  wantsChildren: string;
  childrenDesired?: number;
  financeModel: string;
  careerView: string;
  residenceAfter: string;
  expatriation: string;
  extendedFamilySupport: string;
  traditionsImportance: number;
  interests: string[];
  socialStyle: string;
  verified?: "IDENTITY" | "PROFILE" | "CHURCH";
  isDiaspora?: boolean;
}

const PROFILES: ProfileSeed[] = [
  {
    phone: "+22890000001", firstName: "Claude", gender: "M", seeking: "F", age: 31,
    citySlug: "lome", countryCode: "TG", profession: "Entrepreneur dans le numérique", education: "MASTER",
    bio: "Claude, 31 ans · Entrepreneur dans le numérique · vit à Lomé. Je crois qu'un foyer se construit d'abord dans la prière et la parole tenue.",
    denomination: "EVANGELICAL", commitmentLevel: "COMMITTED", attendance: "WEEKLY", prayerImportance: 5,
    bibleReading: "DAILY", faithInCouple: "Prier ensemble chaque soir et servir dans la même église",
    churchSlug: "adt-tokoin", wantsMarriage: "YES", timeline: "WITHIN_2Y", wantsChildren: "YES", childrenDesired: 3,
    financeModel: "POOLED", careerView: "FLEXIBLE", residenceAfter: "OWN_HOME", expatriation: "PREFER_STAY",
    extendedFamilySupport: "IMPORTANT", traditionsImportance: 3,
    interests: ["technologie", "lecture", "football", "louange"], socialStyle: "BALANCED", verified: "PROFILE",
  },
  {
    phone: "+22890000002", firstName: "Ama", gender: "F", seeking: "M", age: 28,
    citySlug: "lome", countryCode: "TG", profession: "Sage-femme", education: "BACHELOR",
    bio: "Ama, 28 ans · Sage-femme · vit à Lomé. J'aime mon métier, ma famille, et je cherche un homme avec qui avancer sérieusement.",
    denomination: "EVANGELICAL", commitmentLevel: "SERVING", attendance: "MULTIPLE_WEEKLY", prayerImportance: 5,
    bibleReading: "DAILY", faithInCouple: "Prier à deux et grandir ensemble dans la foi",
    churchSlug: "adt-tokoin", wantsMarriage: "YES", timeline: "WITHIN_2Y", wantsChildren: "YES", childrenDesired: 3,
    financeModel: "POOLED", careerView: "BOTH_CAREERS", residenceAfter: "OWN_HOME", expatriation: "PREFER_STAY",
    extendedFamilySupport: "IMPORTANT", traditionsImportance: 4,
    interests: ["chorale", "cuisine", "lecture", "louange"], socialStyle: "BALANCED", verified: "IDENTITY",
  },
  {
    phone: "+22890000003", firstName: "Afi", gender: "F", seeking: "M", age: 26,
    citySlug: "lome", countryCode: "TG", profession: "Enseignante", education: "BACHELOR",
    bio: "Afi, 26 ans · Enseignante · vit à Lomé. Je crois aux choses simples et durables.",
    denomination: "CATHOLIC", commitmentLevel: "REGULAR", attendance: "WEEKLY", prayerImportance: 4,
    bibleReading: "WEEKLY", faithInCouple: "Une foi partagée, vécue sans pression",
    churchSlug: "st-augustin-lome", wantsMarriage: "YES", timeline: "WITHIN_5Y", wantsChildren: "YES", childrenDesired: 2,
    financeModel: "MIXED", careerView: "BOTH_CAREERS", residenceAfter: "OWN_HOME", expatriation: "OPEN",
    extendedFamilySupport: "ESSENTIAL", traditionsImportance: 5,
    interests: ["lecture", "danse", "cuisine", "nature"], socialStyle: "OUTGOING",
  },
  {
    phone: "+22890000004", firstName: "Élodie", gender: "F", seeking: "M", age: 33,
    citySlug: "lome", countryCode: "TG", profession: "Comptable", education: "MASTER",
    bio: "Élodie, 33 ans · Comptable · vit à Lomé. Je ne suis pas pressée, mais je sais ce que je cherche.",
    denomination: "METHODIST", commitmentLevel: "COMMITTED", attendance: "WEEKLY", prayerImportance: 4,
    bibleReading: "WEEKLY", faithInCouple: "Servir ensemble dans notre communauté",
    churchSlug: "emt-agbalepedogan", wantsMarriage: "YES", timeline: "NO_RUSH", wantsChildren: "UNDECIDED",
    financeModel: "SEPARATE", careerView: "BOTH_CAREERS", residenceAfter: "OWN_HOME", expatriation: "OPEN",
    extendedFamilySupport: "OCCASIONAL", traditionsImportance: 2,
    interests: ["voyage", "cinéma", "sport", "podcasts"], socialStyle: "HOMEBODY", verified: "CHURCH",
  },
  {
    phone: "+22890000005", firstName: "Sandrine", gender: "F", seeking: "M", age: 29,
    citySlug: "kpalime", countryCode: "TG", profession: "Infirmière", education: "VOCATIONAL",
    bio: "Sandrine, 29 ans · Infirmière · vit à Kpalimé. Attachée à ma famille et à ma foi.",
    denomination: "PENTECOSTAL", commitmentLevel: "SERVING", attendance: "MULTIPLE_WEEKLY", prayerImportance: 5,
    bibleReading: "DAILY", faithInCouple: "La prière à deux, tous les jours",
    wantsMarriage: "YES", timeline: "WITHIN_1Y", wantsChildren: "YES", childrenDesired: 4,
    financeModel: "POOLED", careerView: "ONE_FOCUS_HOME", residenceAfter: "OWN_HOME", expatriation: "REFUSED",
    extendedFamilySupport: "ESSENTIAL", traditionsImportance: 5,
    interests: ["chant", "cuisine", "jardinage", "louange"], socialStyle: "HOMEBODY",
  },
  {
    phone: "+22890000006", firstName: "Grace", gender: "F", seeking: "M", age: 30,
    citySlug: "paris", countryCode: "FR", profession: "Ingénieure logiciel", education: "MASTER",
    bio: "Grace, 30 ans · Ingénieure logiciel · vit à Paris. Née à Lomé, ouverte à revenir.",
    denomination: "EVANGELICAL", commitmentLevel: "COMMITTED", attendance: "WEEKLY", prayerImportance: 4,
    bibleReading: "WEEKLY", faithInCouple: "Une foi commune, vécue au quotidien",
    wantsMarriage: "YES", timeline: "WITHIN_2Y", wantsChildren: "YES", childrenDesired: 2,
    financeModel: "MIXED", careerView: "BOTH_CAREERS", residenceAfter: "OWN_HOME", expatriation: "WANTED",
    extendedFamilySupport: "IMPORTANT", traditionsImportance: 3,
    interests: ["technologie", "voyage", "lecture", "musique"], socialStyle: "BALANCED",
    isDiaspora: true, verified: "IDENTITY",
  },
  {
    phone: "+22890000007", firstName: "Komlan", gender: "M", seeking: "F", age: 34,
    citySlug: "lome", countryCode: "TG", profession: "Pharmacien", education: "DOCTORATE",
    bio: "Komlan, 34 ans · Pharmacien · vit à Lomé.",
    denomination: "PROTESTANT", commitmentLevel: "REGULAR", attendance: "WEEKLY", prayerImportance: 4,
    bibleReading: "WEEKLY", faithInCouple: "Une foi vécue simplement, sans démonstration",
    churchSlug: "eept-be", wantsMarriage: "YES", timeline: "WITHIN_2Y", wantsChildren: "YES", childrenDesired: 2,
    financeModel: "MIXED", careerView: "BOTH_CAREERS", residenceAfter: "OWN_HOME", expatriation: "OPEN",
    extendedFamilySupport: "IMPORTANT", traditionsImportance: 3,
    interests: ["lecture", "natation", "musique"], socialStyle: "BALANCED",
  },
  {
    phone: "+22890000008", firstName: "Kossi", gender: "M", seeking: "F", age: 27,
    citySlug: "lome", countryCode: "TG", profession: "Développeur web", education: "BACHELOR",
    bio: "Kossi, 27 ans · Développeur web · vit à Lomé.",
    denomination: "PENTECOSTAL", commitmentLevel: "SERVING", attendance: "MULTIPLE_WEEKLY", prayerImportance: 5,
    bibleReading: "DAILY", faithInCouple: "Prier ensemble et servir dans la louange",
    churchSlug: "adt-tokoin", wantsMarriage: "YES", timeline: "WITHIN_1Y", wantsChildren: "YES", childrenDesired: 4,
    financeModel: "POOLED", careerView: "FLEXIBLE", residenceAfter: "OWN_HOME", expatriation: "PREFER_STAY",
    extendedFamilySupport: "ESSENTIAL", traditionsImportance: 4,
    interests: ["technologie", "louange", "football", "musique"], socialStyle: "BALANCED", verified: "PROFILE",
  },
  {
    phone: "+22890000009", firstName: "Yao", gender: "M", seeking: "F", age: 38,
    citySlug: "sokode", countryCode: "TG", profession: "Agronome", education: "MASTER",
    bio: "Yao, 38 ans · Agronome · vit à Sokodé.",
    denomination: "CATHOLIC", commitmentLevel: "REGULAR", attendance: "WEEKLY", prayerImportance: 3,
    bibleReading: "SOMETIMES", faithInCouple: "Le respect mutuel avant tout",
    wantsMarriage: "YES", timeline: "WITHIN_2Y", wantsChildren: "YES", childrenDesired: 3,
    financeModel: "MIXED", careerView: "FLEXIBLE", residenceAfter: "OWN_HOME", expatriation: "REFUSED",
    extendedFamilySupport: "ESSENTIAL", traditionsImportance: 5,
    interests: ["nature", "jardinage", "football"], socialStyle: "HOMEBODY",
  },
  {
    phone: "+22890000010", firstName: "Bénédicte", gender: "F", seeking: "M", age: 24,
    citySlug: "lome", countryCode: "TG", profession: "Étudiante en droit", education: "SECONDARY",
    bio: "Bénédicte, 24 ans · Étudiante en droit · vit à Lomé.",
    denomination: "BAPTIST", commitmentLevel: "COMMITTED", attendance: "WEEKLY", prayerImportance: 4,
    bibleReading: "WEEKLY", faithInCouple: "Grandir ensemble spirituellement",
    churchSlug: "baptiste-nyekonakpoe", wantsMarriage: "PROBABLY", timeline: "WITHIN_5Y", wantsChildren: "UNDECIDED",
    financeModel: "UNDECIDED", careerView: "BOTH_CAREERS", residenceAfter: "UNDECIDED", expatriation: "OPEN",
    extendedFamilySupport: "IMPORTANT", traditionsImportance: 3,
    interests: ["lecture", "danse", "musique", "écriture"], socialStyle: "OUTGOING",
  },
];

function birthDateFor(age: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - age, now.getMonth(), Math.max(1, now.getDate() - 1));
}

async function seedUsers() {
  for (const seed of PROFILES) {
    const city = await prisma.city.findFirst({
      where: { countryCode: seed.countryCode, slug: seed.citySlug },
      include: { region: true },
    });
    if (!city) continue;

    const church = seed.churchSlug ? await prisma.church.findUnique({ where: { slug: seed.churchSlug } }) : null;

    const user = await prisma.user.upsert({
      where: { phone: seed.phone },
      create: {
        phone: seed.phone,
        phoneCountry: seed.countryCode,
        phoneVerified: true,
        status: "ACTIVE",
        role: "USER",
        trustScore: 60,
      },
      update: {},
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        firstName: seed.firstName,
        birthDate: birthDateFor(seed.age),
        gender: seed.gender,
        seeking: seed.seeking,
        bio: seed.bio,
        profession: seed.profession,
        education: seed.education,
        languages: JSON.stringify(["Français"]),
        maritalStatus: "SINGLE",
        countryCode: seed.countryCode,
        regionId: city.regionId,
        cityId: city.id,
        isDiaspora: seed.isDiaspora ?? false,
        completeness: 85,
        isPublished: true,
        publishedAt: new Date(),
      },
      update: {},
    });

    await prisma.faithProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        denomination: seed.denomination,
        churchId: church?.id ?? null,
        commitmentLevel: seed.commitmentLevel,
        attendance: seed.attendance,
        prayerImportance: seed.prayerImportance,
        bibleReading: seed.bibleReading,
        faithInCouple: seed.faithInCouple,
        visibility: JSON.stringify({ faith: "PUBLIC" }),
      },
      update: {},
    });

    await prisma.marriageVision.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        wantsMarriage: seed.wantsMarriage,
        timeline: seed.timeline,
        wantsChildren: seed.wantsChildren,
        childrenDesired: seed.childrenDesired ?? null,
        financeModel: seed.financeModel,
        careerView: seed.careerView,
        residenceAfter: seed.residenceAfter,
        expatriation: seed.expatriation,
        countryAfter: seed.countryCode,
        visibility: JSON.stringify({ marriage: "PUBLIC" }),
      },
      update: {},
    });

    await prisma.familyPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        familyProximity: "SAME_CITY",
        extendedFamilySupport: seed.extendedFamilySupport,
        traditionsImportance: seed.traditionsImportance,
        inLawsRole: "CONSULTED",
        dowryView: "TRADITIONAL",
      },
      update: {},
    });

    await prisma.lifestyle.upsert({
      where: { userId: user.id },
      create: { userId: user.id, interests: JSON.stringify(seed.interests), socialStyle: seed.socialStyle, smoking: "NEVER" },
      update: {},
    });

    await prisma.personalityProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        openness: 50 + ((seed.age * 7) % 40),
        conscientiousness: 50 + ((seed.age * 11) % 40),
        extraversion: 40 + ((seed.age * 13) % 50),
        agreeableness: 55 + ((seed.age * 3) % 35),
        emotionality: 45 + ((seed.age * 5) % 40),
        conflictStyle: "DIALOGUE",
        loveLanguages: JSON.stringify(["Temps de qualité"]),
      },
      update: {},
    });

    await prisma.preferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ageMin: Math.max(18, seed.age - 8),
        ageMax: seed.age + 8,
        scope: seed.isDiaspora ? "INTERNATIONAL" : "COUNTRY",
        openToDiaspora: true,
        openToChildren: true,
      },
      update: {},
    });

    if (seed.verified === "IDENTITY") {
      await prisma.identityVerification.upsert({
        where: { userId: user.id },
        create: { userId: user.id, status: "APPROVED", documentType: "ID_CARD", verifiedAt: new Date(), birthDateChecked: true },
        update: {},
      });
    }
    if (seed.verified === "PROFILE") {
      await prisma.profileVerification.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          status: "APPROVED",
          checkedItems: JSON.stringify(["PHOTOS_AUTHENTIC", "PHOTOS_SAME_PERSON", "CITY_PLAUSIBLE", "NO_DUPLICATE"]),
          verifiedAt: new Date(),
        },
        update: {},
      });
    }
    if (seed.verified === "CHURCH" && church) {
      await prisma.churchVerification.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          churchId: church.id,
          status: "APPROVED",
          answer: "CONFIRMED",
          consentAt: new Date(),
          verifiedAt: new Date(),
          respondentRole: "Responsable jeunesse",
        },
        update: {},
      });
    }
  }
}

async function seedAdmin() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@edenia.app" },
    create: { email: "admin@edenia.app", emailVerified: true, role: "SUPER_ADMIN", status: "ACTIVE" },
    update: { role: "SUPER_ADMIN" },
  });

  await prisma.adminUser.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, displayName: "Équipe EDENIA", roleCode: "SUPER_ADMIN" },
    update: {},
  });

  const agent = await prisma.user.upsert({
    where: { email: "verification@edenia.app" },
    create: { email: "verification@edenia.app", emailVerified: true, role: "VERIFICATION_AGENT", status: "ACTIVE" },
    update: { role: "VERIFICATION_AGENT" },
  });

  await prisma.adminUser.upsert({
    where: { userId: agent.id },
    create: { userId: agent.id, displayName: "Agent de vérification", roleCode: "VERIFICATION_AGENT" },
    update: {},
  });
}

async function seedArticles() {
  const articles = [
    {
      slug: "reconnaitre-une-arnaque-sentimentale",
      title: "Reconnaître une arnaque sentimentale en ligne",
      excerpt: "Les signaux qui doivent vous alerter, et le seul réflexe qui protège vraiment.",
      category: "SAFETY",
      body:
        "Une arnaque sentimentale suit presque toujours le même scénario : une attention intense et rapide, " +
        "une histoire touchante, puis une urgence financière.\n\n" +
        "Les signaux les plus fiables :\n" +
        "— la personne dit vous aimer en quelques jours ;\n" +
        "— elle refuse tout appel vidéo ;\n" +
        "— elle veut quitter EDENIA très vite pour une autre application ;\n" +
        "— une urgence survient : hospitalisation, colis bloqué, frais de visa.\n\n" +
        "Le réflexe : ne transférez jamais d'argent, quelle que soit la raison. Signalez le profil. " +
        "Un signalement protège aussi les personnes qui seront contactées après vous.",
    },
    {
      slug: "parler-argent-avant-le-mariage",
      title: "Parler d'argent avant le mariage",
      excerpt: "Un sujet souvent évité, et pourtant l'un des plus déterminants.",
      category: "PREPARATION",
      body:
        "Beaucoup de couples découvrent leurs désaccords financiers après le mariage. Quelques questions " +
        "posées tôt évitent des années de tension :\n\n" +
        "— Met-on tout en commun, ou chacun garde-t-il une part ?\n" +
        "— Quelle aide apporte-t-on à nos familles respectives, et selon quelles limites ?\n" +
        "— Qui décide au-delà de quel montant ?\n\n" +
        "Il n'y a pas de bonne réponse universelle. Il y a des réponses partagées, et des réponses qu'on " +
        "n'a jamais osé formuler.",
    },
    {
      slug: "la-place-de-la-belle-famille",
      title: "La place de la belle-famille dans le foyer",
      excerpt: "Entre respect des aînés et construction du couple, une question de limites claires.",
      category: "FAMILY",
      body:
        "Dans beaucoup de familles africaines, le mariage unit deux familles autant que deux personnes. " +
        "C'est une richesse, et parfois une pression.\n\n" +
        "La question n'est pas de choisir entre sa famille et son couple, mais de définir ensemble, " +
        "avant le mariage, ce qui relève de la décision du couple et ce qui se discute plus largement.\n\n" +
        "Les couples qui traversent le mieux ce sujet sont ceux qui en ont parlé avant, pas ceux qui " +
        "l'ont découvert au premier désaccord.",
    },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      create: { ...article, status: "PUBLISHED", publishedAt: new Date() },
      update: {},
    });
  }
}

async function main() {
  console.info("Seed EDENIA — démarrage");
  await seedGeography();
  console.info("  ✓ géographie");
  await seedRolesAndPlans();
  console.info("  ✓ rôles et offres");
  await seedChurches();
  console.info("  ✓ églises");
  await seedUsers();
  console.info(`  ✓ ${PROFILES.length} profils de démonstration`);
  await seedAdmin();
  console.info("  ✓ comptes d'administration");
  await seedArticles();
  console.info("  ✓ articles");
  console.info("Seed terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
