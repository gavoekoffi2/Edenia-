import { PrismaClient } from "@prisma/client";

/**
 * Jeu de donnees de TEST — phase pilote interne.
 *
 * §7 de la phase pilote : couvrir tous les cas de figure a tester (homme,
 * femme, compatibilites variees, verifie, non verifie, signale, Premium,
 * gratuit, profil incomplet).
 *
 * Ce script REFUSE de s'executer en production. Les donnees fictives ne doivent
 * jamais atteindre une base reelle : un faux profil chez EDENIA, c'est
 * exactement ce que le §65 promet de combattre.
 *
 *   npm run db:seed:dev
 *
 * Tous les comptes utilisent des numeros togolais et se connectent avec le code
 * de test 228228 (AUTH_MODE=development).
 */

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.error(
    "\n⛔ seed-dev est interdit en production.\n" +
      "   Ces profils sont fictifs et fausseraient les statistiques comme la découverte.\n",
  );
  process.exit(1);
}

interface DevUser {
  phone: string;
  firstName: string;
  gender: "F" | "M";
  seeking: "F" | "M";
  age: number;
  citySlug: string;
  profession: string;
  bio: string;
  denomination: string;
  commitmentLevel: string;
  attendance: string;
  prayerImportance: number;
  faithInCouple: string;
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
  /** Scenario de test que ce compte incarne. */
  scenario: string;
  verified?: Array<"IDENTITY" | "PROFILE" | "CHURCH">;
  premium?: boolean;
  reported?: { category: string; detail: string };
  restricted?: boolean;
  /** Profil volontairement incomplet, pour tester la confiance « LOW ». */
  sparse?: boolean;
  published?: boolean;
}

/**
 * Le compte de reference masculin. Les profils feminins ci-dessous sont calibres
 * pour produire des compatibilites franchement differentes avec lui, afin qu'on
 * puisse verifier a l'oeil que le moteur classe correctement.
 */
const REFERENCE: DevUser = {
  phone: "+22890000101",
  firstName: "Yao",
  gender: "M",
  seeking: "F",
  age: 30,
  citySlug: "lome",
  profession: "Développeur",
  bio: "Yao, 30 ans · Développeur · vit à Lomé. Je cherche une relation sérieuse tournée vers le mariage.",
  denomination: "EVANGELICAL",
  commitmentLevel: "COMMITTED",
  attendance: "WEEKLY",
  prayerImportance: 5,
  faithInCouple: "Prier ensemble et servir dans la même église",
  wantsMarriage: "YES",
  timeline: "WITHIN_2Y",
  wantsChildren: "YES",
  childrenDesired: 3,
  financeModel: "POOLED",
  careerView: "FLEXIBLE",
  residenceAfter: "OWN_HOME",
  expatriation: "PREFER_STAY",
  extendedFamilySupport: "IMPORTANT",
  traditionsImportance: 3,
  interests: ["technologie", "lecture", "football", "louange"],
  socialStyle: "BALANCED",
  scenario: "Compte de référence masculin — utilisez-le pour tester la découverte et les matchs.",
  verified: ["PROFILE"],
};

const DEV_USERS: DevUser[] = [
  REFERENCE,

  // --- Compatibilité très élevée -------------------------------------------
  {
    phone: "+22890000102",
    firstName: "Akosua",
    gender: "F",
    seeking: "M",
    age: 27,
    citySlug: "lome",
    profession: "Infirmière",
    bio: "Akosua, 27 ans · Infirmière · vit à Lomé.",
    denomination: "EVANGELICAL",
    commitmentLevel: "COMMITTED",
    attendance: "WEEKLY",
    prayerImportance: 5,
    faithInCouple: "Prier ensemble chaque jour et servir dans notre église",
    wantsMarriage: "YES",
    timeline: "WITHIN_2Y",
    wantsChildren: "YES",
    childrenDesired: 3,
    financeModel: "POOLED",
    careerView: "FLEXIBLE",
    residenceAfter: "OWN_HOME",
    expatriation: "PREFER_STAY",
    extendedFamilySupport: "IMPORTANT",
    traditionsImportance: 3,
    interests: ["lecture", "louange", "cuisine", "football"],
    socialStyle: "BALANCED",
    scenario: "Compatibilité très élevée avec Yao + identité et église vérifiées.",
    verified: ["IDENTITY", "CHURCH"],
  },

  // --- Compatibilité moyenne : même foi, projet différent -------------------
  {
    phone: "+22890000103",
    firstName: "Délali",
    gender: "F",
    seeking: "M",
    age: 32,
    citySlug: "lome",
    profession: "Juriste",
    bio: "Délali, 32 ans · Juriste · vit à Lomé.",
    denomination: "EVANGELICAL",
    commitmentLevel: "REGULAR",
    attendance: "WEEKLY",
    prayerImportance: 4,
    faithInCouple: "Une foi partagée, vécue sans pression",
    wantsMarriage: "YES",
    timeline: "NO_RUSH",
    wantsChildren: "UNDECIDED",
    financeModel: "SEPARATE",
    careerView: "BOTH_CAREERS",
    residenceAfter: "OWN_HOME",
    expatriation: "WANTED",
    extendedFamilySupport: "LIMITED",
    traditionsImportance: 2,
    interests: ["voyage", "cinéma", "lecture"],
    socialStyle: "OUTGOING",
    scenario: "Compatibilité moyenne — même foi, mais horizon, enfants et expatriation divergent.",
    premium: true,
  },

  // --- Compatibilité faible : dénomination et vision opposées ---------------
  {
    phone: "+22890000104",
    firstName: "Sylvie",
    gender: "F",
    seeking: "M",
    age: 38,
    citySlug: "dapaong",
    profession: "Commerçante",
    bio: "Sylvie, 38 ans · Commerçante · vit à Dapaong.",
    denomination: "CATHOLIC",
    commitmentLevel: "OCCASIONAL",
    attendance: "MONTHLY",
    prayerImportance: 2,
    faithInCouple: "Chacun garde sa pratique",
    wantsMarriage: "PROBABLY",
    timeline: "NO_RUSH",
    wantsChildren: "NO",
    financeModel: "SEPARATE",
    careerView: "BOTH_CAREERS",
    residenceAfter: "WITH_FAMILY",
    expatriation: "WANTED",
    extendedFamilySupport: "ESSENTIAL",
    traditionsImportance: 5,
    interests: ["mode", "danse"],
    socialStyle: "OUTGOING",
    scenario: "Compatibilité faible — utile pour vérifier que le score descend vraiment.",
  },

  // --- Profil peu rempli : teste la confiance « LOW » -----------------------
  {
    phone: "+22890000105",
    firstName: "Ayoko",
    gender: "F",
    seeking: "M",
    age: 25,
    citySlug: "kpalime",
    profession: "Étudiante",
    bio: "Ayoko, 25 ans · Kpalimé.",
    denomination: "PREFER_NOT_SAY",
    commitmentLevel: "",
    attendance: "",
    prayerImportance: 0,
    faithInCouple: "",
    wantsMarriage: "",
    timeline: "",
    wantsChildren: "",
    financeModel: "",
    careerView: "",
    residenceAfter: "",
    expatriation: "",
    extendedFamilySupport: "",
    traditionsImportance: 0,
    interests: [],
    socialStyle: "",
    scenario: "Profil très peu rempli — le score doit être tempéré et la confiance affichée « LOW ».",
    sparse: true,
  },

  // --- Compte signalé : teste la modération ---------------------------------
  {
    phone: "+22890000106",
    firstName: "Kossi",
    gender: "M",
    seeking: "F",
    age: 35,
    citySlug: "lome",
    profession: "Commerçant",
    bio: "Kossi, 35 ans · Commerçant · vit à Lomé.",
    denomination: "PENTECOSTAL",
    commitmentLevel: "REGULAR",
    attendance: "WEEKLY",
    prayerImportance: 3,
    faithInCouple: "La foi au centre",
    wantsMarriage: "YES",
    timeline: "WITHIN_1Y",
    wantsChildren: "YES",
    childrenDesired: 4,
    financeModel: "POOLED",
    careerView: "ONE_FOCUS_HOME",
    residenceAfter: "OWN_HOME",
    expatriation: "PREFER_STAY",
    extendedFamilySupport: "ESSENTIAL",
    traditionsImportance: 4,
    interests: ["football", "musique"],
    socialStyle: "OUTGOING",
    scenario: "Compte signalé pour demande d'argent — apparaît dans la file de modération.",
    reported: {
      category: "SCAM_MONEY",
      detail: "Signalement de test : a demandé un transfert Flooz dès le deuxième message.",
    },
  },

  // --- Compte restreint : teste l'effet d'une sanction ----------------------
  {
    phone: "+22890000107",
    firstName: "Edem",
    gender: "M",
    seeking: "F",
    age: 29,
    citySlug: "tsevie",
    profession: "Mécanicien",
    bio: "Edem, 29 ans · Mécanicien · vit à Tsévié.",
    denomination: "METHODIST",
    commitmentLevel: "REGULAR",
    attendance: "WEEKLY",
    prayerImportance: 3,
    faithInCouple: "Une foi tranquille",
    wantsMarriage: "YES",
    timeline: "WITHIN_2Y",
    wantsChildren: "YES",
    childrenDesired: 2,
    financeModel: "MIXED",
    careerView: "FLEXIBLE",
    residenceAfter: "OWN_HOME",
    expatriation: "OPEN",
    extendedFamilySupport: "OCCASIONAL",
    traditionsImportance: 3,
    interests: ["football", "musique", "marche"],
    socialStyle: "BALANCED",
    scenario: "Compte sous restriction — ne doit pas apparaître dans la découverte.",
    restricted: true,
  },

  // --- Femmes supplémentaires, pour un rail de découverte crédible ----------
  {
    phone: "+22890000108",
    firstName: "Mawuli",
    gender: "F",
    seeking: "M",
    age: 29,
    citySlug: "sokode",
    profession: "Enseignante",
    bio: "Mawuli, 29 ans · Enseignante · vit à Sokodé.",
    denomination: "PENTECOSTAL",
    commitmentLevel: "SERVING",
    attendance: "MULTIPLE_WEEKLY",
    prayerImportance: 5,
    faithInCouple: "Prier à deux, servir ensemble",
    wantsMarriage: "YES",
    timeline: "WITHIN_1Y",
    wantsChildren: "YES",
    childrenDesired: 3,
    financeModel: "POOLED",
    careerView: "FLEXIBLE",
    residenceAfter: "OWN_HOME",
    expatriation: "PREFER_STAY",
    extendedFamilySupport: "IMPORTANT",
    traditionsImportance: 4,
    interests: ["chorale", "louange", "lecture", "cuisine"],
    socialStyle: "BALANCED",
    scenario: "Bonne compatibilité mais autre ville — teste la dimension Localisation.",
    verified: ["IDENTITY"],
  },
  {
    phone: "+22890000109",
    firstName: "Essi",
    gender: "F",
    seeking: "M",
    age: 31,
    citySlug: "kara",
    profession: "Pharmacienne",
    bio: "Essi, 31 ans · Pharmacienne · vit à Kara.",
    denomination: "BAPTIST",
    commitmentLevel: "COMMITTED",
    attendance: "WEEKLY",
    prayerImportance: 4,
    faithInCouple: "Grandir ensemble dans la foi",
    wantsMarriage: "YES",
    timeline: "WITHIN_2Y",
    wantsChildren: "YES",
    childrenDesired: 2,
    financeModel: "MIXED",
    careerView: "BOTH_CAREERS",
    residenceAfter: "OWN_HOME",
    expatriation: "OPEN",
    extendedFamilySupport: "IMPORTANT",
    traditionsImportance: 3,
    interests: ["lecture", "natation", "musique"],
    socialStyle: "HOMEBODY",
    scenario: "Profil gratuit, non vérifié, bonne compatibilité — cas le plus courant.",
  },
  {
    phone: "+22890000110",
    firstName: "Afiwa",
    gender: "F",
    seeking: "M",
    age: 26,
    citySlug: "atakpame",
    profession: "Coiffeuse",
    bio: "Afiwa, 26 ans · Coiffeuse · vit à Atakpamé.",
    denomination: "EVANGELICAL",
    commitmentLevel: "REGULAR",
    attendance: "WEEKLY",
    prayerImportance: 4,
    faithInCouple: "La prière en couple compte pour moi",
    wantsMarriage: "YES",
    timeline: "WITHIN_2Y",
    wantsChildren: "YES",
    childrenDesired: 3,
    financeModel: "POOLED",
    careerView: "FLEXIBLE",
    residenceAfter: "OWN_HOME",
    expatriation: "PREFER_STAY",
    extendedFamilySupport: "IMPORTANT",
    traditionsImportance: 4,
    interests: ["mode", "louange", "cuisine", "danse"],
    socialStyle: "OUTGOING",
    scenario: "Profil Premium gratuit à comparer — teste le rail « Compatibilité élevée ».",
  },
  {
    phone: "+22890000111",
    firstName: "Rachelle",
    gender: "F",
    seeking: "M",
    age: 34,
    citySlug: "lome",
    profession: "Cheffe de projet",
    bio: "Rachelle, 34 ans · Cheffe de projet · vit à Lomé. Profil non publié pour l'instant.",
    denomination: "PROTESTANT",
    commitmentLevel: "COMMITTED",
    attendance: "WEEKLY",
    prayerImportance: 4,
    faithInCouple: "Une foi partagée au quotidien",
    wantsMarriage: "YES",
    timeline: "WITHIN_2Y",
    wantsChildren: "UNDECIDED",
    financeModel: "MIXED",
    careerView: "BOTH_CAREERS",
    residenceAfter: "OWN_HOME",
    expatriation: "OPEN",
    extendedFamilySupport: "OCCASIONAL",
    traditionsImportance: 3,
    interests: ["lecture", "voyage", "podcasts"],
    socialStyle: "BALANCED",
    scenario: "Profil NON publié — ne doit jamais apparaître dans la découverte.",
    published: false,
  },
];

function birthDateFor(age: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - age, now.getMonth(), Math.max(1, now.getDate() - 1));
}

const orNull = (value: string | undefined): string | null => (value ? value : null);

async function main() {
  console.info("\n🟡 Seed de DÉVELOPPEMENT — profils fictifs, marché pilote Togo\n");

  const cityCache = new Map<string, { id: string; regionId: string }>();
  for (const slug of new Set(DEV_USERS.map((u) => u.citySlug))) {
    const city = await prisma.city.findFirst({ where: { countryCode: "TG", slug } });
    if (!city) {
      console.error(`  ⛔ ville introuvable : ${slug}. Lancez d'abord « npm run db:reset ».`);
      process.exit(1);
    }
    cityCache.set(slug, { id: city.id, regionId: city.regionId });
  }

  const created: Array<{ phone: string; firstName: string; scenario: string }> = [];

  for (const seed of DEV_USERS) {
    const city = cityCache.get(seed.citySlug)!;

    const user = await prisma.user.upsert({
      where: { phone: seed.phone },
      create: {
        phone: seed.phone,
        phoneCountry: "TG",
        phoneVerified: true,
        status: seed.restricted ? "RESTRICTED" : "ACTIVE",
        role: "USER",
      },
      update: { status: seed.restricted ? "RESTRICTED" : "ACTIVE" },
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
        education: "BACHELOR",
        languages: JSON.stringify(["Français"]),
        maritalStatus: "SINGLE",
        countryCode: "TG",
        regionId: city.regionId,
        cityId: city.id,
        completeness: seed.sparse ? 35 : 85,
        isPublished: seed.published !== false && !seed.restricted,
        publishedAt: new Date(),
      },
      update: {},
    });

    // Le profil « sparse » n'a volontairement ni foi, ni vision du mariage :
    // c'est ce qui permet de vérifier la tempérisation du score.
    if (!seed.sparse) {
      await prisma.faithProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          denomination: seed.denomination,
          commitmentLevel: orNull(seed.commitmentLevel),
          attendance: orNull(seed.attendance),
          prayerImportance: seed.prayerImportance || null,
          bibleReading: "WEEKLY",
          faithInCouple: orNull(seed.faithInCouple),
          visibility: JSON.stringify({ faith: "PUBLIC" }),
        },
        update: {},
      });

      await prisma.marriageVision.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          wantsMarriage: orNull(seed.wantsMarriage),
          timeline: orNull(seed.timeline),
          wantsChildren: orNull(seed.wantsChildren),
          childrenDesired: seed.childrenDesired ?? null,
          financeModel: orNull(seed.financeModel),
          careerView: orNull(seed.careerView),
          residenceAfter: orNull(seed.residenceAfter),
          expatriation: orNull(seed.expatriation),
          countryAfter: "TG",
          visibility: JSON.stringify({ marriage: "PUBLIC" }),
        },
        update: {},
      });

      await prisma.familyPreferences.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          familyProximity: "SAME_CITY",
          extendedFamilySupport: orNull(seed.extendedFamilySupport),
          traditionsImportance: seed.traditionsImportance || null,
          inLawsRole: "CONSULTED",
          dowryView: "TRADITIONAL",
        },
        update: {},
      });

      await prisma.personalityProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          openness: 45 + ((seed.age * 7) % 45),
          conscientiousness: 50 + ((seed.age * 11) % 40),
          extraversion: 40 + ((seed.age * 13) % 50),
          agreeableness: 55 + ((seed.age * 3) % 35),
          emotionality: 45 + ((seed.age * 5) % 40),
          conflictStyle: "DIALOGUE",
          loveLanguages: JSON.stringify(["Temps de qualité"]),
        },
        update: {},
      });
    }

    await prisma.lifestyle.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        interests: JSON.stringify(seed.interests),
        socialStyle: orNull(seed.socialStyle),
        smoking: "NEVER",
      },
      update: {},
    });

    await prisma.preferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ageMin: Math.max(18, seed.age - 10),
        ageMax: seed.age + 10,
        scope: "COUNTRY",
        openToDiaspora: true,
        openToChildren: true,
      },
      update: {},
    });

    for (const level of seed.verified ?? []) {
      if (level === "IDENTITY") {
        await prisma.identityVerification.upsert({
          where: { userId: user.id },
          create: { userId: user.id, status: "APPROVED", documentType: "ID_CARD", verifiedAt: new Date(), birthDateChecked: true },
          update: { status: "APPROVED" },
        });
      }
      if (level === "PROFILE") {
        await prisma.profileVerification.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            status: "APPROVED",
            checkedItems: JSON.stringify(["PHOTOS_AUTHENTIC", "PHOTOS_SAME_PERSON", "CITY_PLAUSIBLE", "NO_DUPLICATE"]),
            verifiedAt: new Date(),
          },
          update: { status: "APPROVED" },
        });
      }
      if (level === "CHURCH") {
        const church = await prisma.church.findFirst({ where: { countryCode: "TG" } });
        if (church) {
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
            update: { status: "APPROVED" },
          });
        }
      }
    }

    if (seed.premium) {
      const plan = await prisma.plan.findUnique({ where: { code: "PREMIUM_3M" } });
      if (plan) {
        const existing = await prisma.subscription.findFirst({ where: { userId: user.id, status: "ACTIVE" } });
        if (!existing) {
          await prisma.subscription.create({
            data: {
              userId: user.id,
              planCode: plan.code,
              status: "ACTIVE",
              startsAt: new Date(),
              endsAt: new Date(Date.now() + plan.durationDays * 86_400_000),
            },
          });
        }
      }
    }

    if (seed.reported) {
      const reporter = await prisma.user.findFirst({ where: { phone: REFERENCE.phone } });
      if (reporter && reporter.id !== user.id) {
        const already = await prisma.report.findFirst({ where: { reportedId: user.id, status: "OPEN" } });
        if (!already) {
          await prisma.report.create({
            data: {
              reporterId: reporter.id,
              reportedId: user.id,
              category: seed.reported.category,
              detail: seed.reported.detail,
              severity: "HIGH",
            },
          });
          await prisma.trustSignal.create({
            data: {
              userId: user.id,
              kind: "MONEY_REQUEST",
              weight: -30,
              detail: "Signal de test : demande d'argent détectée.",
            },
          });
        }
      }
    }

    created.push({ phone: seed.phone, firstName: seed.firstName, scenario: seed.scenario });
  }

  console.info("Comptes de test créés (code OTP : 228228)\n");
  for (const entry of created) {
    console.info(`  ${entry.phone}  ${entry.firstName.padEnd(10)} ${entry.scenario}`);
  }
  console.info("\nAdministration : admin@edenia.app (super admin) · verification@edenia.app (agent)");
  console.info("Ces profils sont fictifs. Ne jamais exécuter ce script en production.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
