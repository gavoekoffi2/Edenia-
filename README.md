# EDENIA

**Des rencontres guidées par la foi.**
Plateforme PWA de rencontres chrétiennes pour l'Afrique francophone.

> Pensée en Afrique. Conçue pour la foi. Orientée vers le foyer.

---

## Phase actuelle : bêta fermée, marché pilote 🇹🇬 Togo

**EDENIA est gratuite.** Pas d'abonnement, pas de fonctionnalité réservée. La
plateforme vit de dons volontaires qui ne donnent **aucun** avantage à ceux qui
les font — voir [`docs/13`](docs/13-lancement-gratuit-et-dons.md).

```bash
npm install
npm run db:reset:dev   # base + 11 profils de test togolais
npm run dev            # http://localhost:3000
```

Créez un compte sur `/inscription` avec un numéro togolais (8 chiffres,
commençant par 7 ou 9). **Le code de vérification est `228228`**, également
affiché à l'écran : aucun SMS n'est envoyé.

Le mode développement ne désactive aucun contrôle — le code est simplement
prévisible, puis haché, salé, comparé à temps constant et soumis aux mêmes
limites qu'en production. `AUTH_MODE=development` **fait échouer le démarrage**
en production. Détails : [`docs/11`](docs/11-phase-pilote-test-interne.md).

## Démarrer sans données de test

```bash
npm run db:reset     # référentiels seuls, sans profils fictifs
npm run dev
```

**Aucun service externe n'est requis.** Les fournisseurs IA, SMS, e-mail et
paiement ont chacun une implémentation locale déterministe : le parcours complet
— inscription, onboarding conversationnel, découverte, match, chat, vérification
— tourne hors ligne. En développement, le code OTP est renvoyé dans la réponse
de l'API et affiché à l'écran.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | 178 tests (matching, IA, confidentialité, sécurité, paiement, dons, admin) |
| `npm run lint` | ESLint (0 erreur, 0 avertissement) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` | Build de production |
| `npm run db:reset` | Réinitialise la base (référentiels seuls) |
| `npm run db:reset:dev` | Idem + 11 profils de test togolais |
| `npm run admin:create` | Crée un compte interne et imprime son lien de configuration |
| `npm run admin:reset` | Efface mot de passe et MFA, réémet un lien |
| `npm run admin:list` | État des comptes internes |
| `npm run purge` | Applique les durées de rétention (`--dry-run` pour un inventaire) |

### Ouvrir le back-office

Il n'existe **aucun compte administrateur par défaut**. On en crée un :

```bash
npm run admin:create -- --email=vous@exemple.com --name="Votre nom"
```

La commande ne fabrique pas de mot de passe : elle imprime un lien à usage
unique. Connectez-vous à EDENIA avec cette adresse (code `228228`), ouvrez le
lien, choisissez votre mot de passe, scannez le QR code avec une application
d'authentification, notez vos dix codes de récupération. Ensuite, `/admin`
demande mot de passe **et** code à 6 chiffres à chaque session.

Lien perdu : `npm run admin:reset -- --email=…`. Procédure complète dans
[`docs/09`](docs/09-roles-admin-securite.md) §2.2.

Les 11 comptes de test togolais sont listés dans
[`docs/11`](docs/11-phase-pilote-test-interne.md) §6.

---

## Ce qui est construit

| | |
|---|---|
| **Analyse** | 11 contradictions du cahier des charges identifiées et arbitrées, 7 décisions produit manquantes, 5 risques majeurs — [`docs/00`](docs/00-analyse-cahier-des-charges.md) |
| **Matching** | 7 dimensions pondérées, critères essentiels bilatéraux, explication filtrée par la visibilité — [`docs/07`](docs/07-matching.md) |
| **EDENIA AI** | Onboarding conversationnel texte/voix, extraction ancrée, garde-fous exécutables — [`docs/06`](docs/06-edenia-ai.md) |
| **Confiance** | 5 niveaux de vérification, anti-arnaque, trust score interne — [`docs/08`](docs/08-verification.md) |
| **Application** | Auth OTP, profil, photos, découverte, likes, matchs, chat, Premium, back-office |
| **PWA** | Installable, optimisée 3G et téléphones d'entrée de gamme — [`docs/05`](docs/05-pwa.md) |
| **Site public** | 16 pages rédigées et optimisées SEO |

| **Paiement** | GeniusPay : checkout hébergé, webhook signé HMAC, idempotence, machine d'état — [`docs/12`](docs/12-geniuspay.md) |
| **Lancement gratuit** | Premium éteint, dons sans contrepartie, back-office complet — [`docs/13`](docs/13-lancement-gratuit-et-dons.md) |

Reste à faire avant une ouverture au grand public : clés GeniusPay live,
passerelle SMS réelle, modération automatique des images, budget JS (172 ko
contre 120 ko visés), audit externe. Détail dans
[`docs/10`](docs/10-roadmap-modules.md).

---

## Les décisions qui structurent le produit

Ces choix ne sont pas des détails d'implémentation : ce sont les règles du
cahier des charges traduites en contraintes que le code fait respecter.

**Un score de compatibilité ne peut pas s'afficher seul.** Le composant
`CompatibilityMeter` exige sa légende : sans elle, le code ne compile pas. Le
score est plafonné à 97 % — jamais 100 — et tempéré quand les données sont
insuffisantes, pour ne pas produire un « 95 % » à partir de trois champs.

**L'IA ne peut pas inventer.** Toute valeur extraite doit porter une citation
réellement présente dans les propos de l'utilisateur. Sans citation vérifiable,
elle est rejetée — même si le modèle l'affirme avec une confiance de 1. « Je ne
sais pas encore » devient « à discuter », jamais un choix arbitraire.

**Payer n'achète jamais la sécurité.** Signaler, bloquer, voir un badge et
demander sa propre vérification restent gratuits pour tout le monde. Au
lancement, tout l'est : Premium existe dans le code mais aucun membre ne le
voit. Un don ne donne ni badge, ni visibilité, ni meilleur matching, ni quota
supérieur — la liste `DONATION_GRANTS_NOTHING` rend la règle vérifiable par
test.

**Le back-office demande trois preuves.** Une session EDENIA ne l'ouvre pas :
il faut en plus un mot de passe administrateur et un code TOTP. Aucun compte par
défaut, aucun mot de passe universel, aucun endpoint de contournement — le
premier administrateur naît d'un lien à usage unique, et choisit lui-même son
secret.

**Un chiffre qu'on ne mesure pas s'affiche comme non mesuré.** L'entonnoir
d'activation commence par « Visite du site », que nous n'instrumentons pas :
il est rendu vide, avec son motif, plutôt que rempli avec le nombre d'inscrits.

**Le trust score ne sort pas du back-office.** Le badge public est factuel
(« ceci a été contrôlé ») ; le score interne est probabiliste et invisible. Un
test échoue si une réponse API le laisse fuir.

**L'église ne voit rien.** La vérification par une église passe par une question
fermée unique, avec consentement explicite et révocable. L'église n'a aucun
accès au profil, aux matchs ou aux messages, et ne voit jamais la liste de ses
membres inscrits.

**Un seul canal de contact suffit.** Téléphone **ou** e-mail. Jamais les deux.
Le format local (« 90 12 34 56 ») est accepté et complété avec l'indicatif du
pays choisi.

**Le paiement n'active rien tant que le backend ne l'a pas confirmé.** Le retour
sur `success_url` ne prouve rien — n'importe qui peut ouvrir cette URL. Premium
n'est activé que sur un webhook signé ou une consultation directe de
l'agrégateur. Le traitement est idempotent : deux livraisons du même événement
ne créent pas deux abonnements.

**Aucune police web.** Le stack système coûte 0 ko ; une police Google coûte
150 à 250 ko avant le premier texte lisible. Sur une 3G à 400 kbit/s, c'est
l'optimisation la plus rentable — et personne ne remarque l'absence.

---

## Architecture

```
docs/            00 → 13 : analyse, architecture, données, parcours, design,
                 PWA, IA, matching, vérification, sécurité, feuille de route,
                 phase pilote, GeniusPay, lancement gratuit
prisma/          Schéma (50 entités, portable SQLite ↔ PostgreSQL) + seed
src/app/         Pages publiques, application, back-office, API /api/v1/**
src/components/  Composants d'interface
src/lib/         Logique métier, sans dépendance à React ni à HTTP
  admin/         Back-office : mot de passe, TOTP, invitations, statistiques
  ai/            Couche IA : fournisseurs, extraction, garde-fous
  donations/     Dons volontaires, strictement séparés des abonnements
  matching/      Moteur de compatibilité (pur, testable sans base)
  auth/          OTP, sessions, RBAC, limitation de débit
  trust/         Anti-arnaque, score interne
  verification/  Niveaux, listes de contrôle, question église
  payments/      GeniusPay : client, webhook signé, machine d'état
  storage/       Traitement et stockage des photos
  geo/           Référentiel pays/régions/villes + règles de numérotation
  db/            Client Prisma + frontière de sérialisation publique
  privacy/       Application des durées de rétention
  settings/      Réglages modifiables depuis le back-office
tests/           178 tests
```

Pile : Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
Prisma 6 · Zod 4 · Vitest. Zéro vulnérabilité connue au moment du build.

Détail des choix : [`docs/01`](docs/01-architecture.md).

---

## Configuration

Copier `.env.example` vers `.env`. En production, l'application **refuse de
démarrer** si un secret de développement est encore en place — le contrôle
s'applique au démarrage du serveur, pas pendant le build, pour ne pas casser
l'intégration continue.

Passage à PostgreSQL : changer une ligne dans `prisma/schema.prisma` et
`DATABASE_URL`. Le schéma s'interdit les enums et tableaux natifs précisément
pour rendre cette bascule triviale ([`docs/02`](docs/02-modele-de-donnees.md) §6).

---

## Ce qu'EDENIA n'est pas

Tinder avec une identité chrétienne. Un site matrimonial classique. Un réseau
social chrétien. Une plateforme généraliste disponible en Afrique. Une
plateforme qui promet « l'âme sœur envoyée par Dieu ».

EDENIA ne remplace ni Dieu, ni l'église, ni la famille, ni les professionnels.
Elle fournit l'infrastructure numérique qui facilite des rencontres sérieuses,
sûres et pertinentes.
