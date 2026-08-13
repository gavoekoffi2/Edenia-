# 02 — Modèle de données

Source de vérité : `prisma/schema.prisma`. Ce document explique **pourquoi** le
schéma est ainsi, et les points où il s'écarte d'une modélisation naïve.

## 1. Portabilité SQLite ↔ PostgreSQL

Le schéma s'interdit trois choses :

| Interdit | Utilisé à la place | Raison |
|---|---|---|
| `enum` Prisma | `String` + constantes dans `src/lib/config/enums.ts`, validées par Zod | Les enums Prisma ne sont pas supportés sur SQLite |
| Tableaux natifs (`String[]`) | JSON sérialisé, ou table de jointure | Idem |
| Types spécifiques Postgres | — | Bascule d'une ligne en production |

Conséquence concrète : `npm run db:reset` fonctionne sans aucun service externe,
et le parcours complet est testable hors ligne. En production, on change
`provider = "postgresql"` et `DATABASE_URL`.

**À faire à la bascule** (voir §6) : index `GIN` pour la recherche, recherche
plein texte, pooling de connexions.

## 2. Les entités du §49, et ce qui a été ajouté

Les 43 entités listées au §49 sont présentes. Sept ont été ajoutées parce que le
cahier des charges les implique sans les nommer :

| Entité ajoutée | Pourquoi |
|---|---|
| `OtpChallenge` | §8 et §50 : l'OTP a besoin d'un état persistant (tentatives, expiration) |
| `Device` | §34 : détecter les comptes multiples exige une empreinte d'appareil |
| `PushSubscription` | §46 : les Web Push exigent de stocker l'abonnement du navigateur |
| `Consent` | §47 : un consentement doit être horodaté, versionné et révocable |
| `VerificationEvent` | §52 : « historique » du dossier de vérification |
| `ProfileView` | §31 : « voir qui vous a consulté » (Premium) |
| `DateCheck` | §41 : « Je vais à un rendez-vous » |
| `Plan` | §43 : les offres doivent être modifiables sans redéploiement |
| `RateLimitCounter` | §50 : limitation de débit sans dépendance Redis au pilote |

## 3. Décisions de modélisation notables

### 3.1 `birthDate`, jamais `age`

L'âge est recalculé à chaque lecture (`ageFromBirthDate`). Stocker un entier
« âge » produit des profils qui vieillissent mal et rend impossible le contrôle
des 18 ans lors de la vérification d'identité.

Corollaire : `birthDate` figure dans `PRIVATE_KEYS` — seul l'âge dérivé est
public.

### 3.2 Les canaux de contact sont doubles, et c'est voulu

`User.phone` / `User.email` portent le canal **principal** (celui de
l'inscription), et `ContactMethod` porte tous les canaux, y compris ajoutés
après coup. La redondance simplifie le chemin critique de connexion — qui doit
rester une lecture indexée unique — tout en permettant plusieurs canaux (§8).

### 3.3 `Match` : identifiants ordonnés

`userAId < userBId` par convention, garanti à l'écriture. Sans cet ordre, la
contrainte `@@unique([userAId, userBId])` laisserait passer un doublon
(A,B) / (B,A) — bug classique et pénible à rattraper une fois en production.

### 3.4 Vérification : quatre tables, pas une

`VerificationRequest` porte le **flux** (statut, agent, historique) ;
`IdentityVerification`, `ProfileVerification` et `ChurchVerification` portent
l'**état** de chaque niveau. Séparer permet à un utilisateur d'avoir un dossier
identité approuvé et une demande église en cours, sans état incohérent.

`ChurchVerification.answer` ne peut valoir que `CONFIRMED` / `NOT_KNOWN` /
`DECLINED` : l'église répond à une question fermée et rien d'autre n'est
stocké (§28, C6).

### 3.5 `TrustSignal` est un journal, pas un compteur

Le score n'est pas stocké comme vérité : il est recalculé depuis les signaux
(`computeTrustScore`), avec décroissance temporelle. `User.trustScore` n'est
qu'un cache pour les requêtes de filtrage. Un journal est auditable ; un
compteur incrémenté ne l'est pas.

### 3.6 `AIProfileExtraction` conserve confiance ET citation

C'est la matérialisation du §13. Les extractions rejetées sont conservées elles
aussi : elles constituent la trace qui permet de vérifier, en production, que le
garde-fou fonctionne réellement — et pas seulement dans les tests.

### 3.7 Visibilité stockée en JSON

`FaithProfile.visibility` et `MarriageVision.visibility` portent un objet
`{ section: PUBLIC | MATCHES | PRIVATE }`. Une table dédiée serait plus pure,
mais la visibilité est toujours lue en même temps que la section qu'elle
concerne : la garder dans la même ligne évite une jointure sur le chemin le plus
chaud de l'application (la découverte).

## 4. Index

Les index suivent les trois requêtes qui dominent la charge :

| Requête | Index |
|---|---|
| Découverte | `Profile(countryCode, cityId, gender)`, `Profile(isPublished, publishedAt)` |
| Fil de conversation | `Message(conversationId, createdAt)` |
| File de modération | `Report(status, severity, createdAt)` |
| Activité | `User(status, lastActiveAt)` |
| Anti-fraude | `Device(fingerprint)`, `TrustSignal(userId, createdAt)` |

## 5. Rétention et suppression (M3, §47)

| Donnée | Durée |
|---|---|
| Pièces d'identité et selfies | Détruits ≤ 7 jours après décision (`purgeAfter`) |
| Compte supprimé | Statut `DELETED` immédiat, effacement sous 30 j |
| Compte inactif | 24 mois → notification → anonymisation |
| `AuditLog` | Conservé, avec `actorRef` pseudonymisé |
| Audio d'onboarding | Détruit après transcription, jamais stocké |

La suppression est en deux temps volontairement : effet immédiat visible
(profil retiré, sessions révoquées), effacement différé — une suppression
accidentelle doit pouvoir être rattrapée.

## 6. Bascule vers PostgreSQL

1. `provider = "postgresql"` dans `prisma/schema.prisma`.
2. `DATABASE_URL=postgresql://…`.
3. `npx prisma migrate dev --name init` pour générer la première migration.
4. Ajouter les index spécifiques :
   - `pg_trgm` + index GIN sur `City.nameFr` et `Church.name` (autocomplétion) ;
   - index partiel sur `Profile(isPublished) WHERE isPublished = true`.
5. Activer le pooling (PgBouncer ou équivalent) — le mode serverless ouvre
   sinon une connexion par requête.
6. Les champs JSON (`languages`, `interests`, `visibility`) peuvent devenir
   `jsonb` ; ce n'est pas nécessaire au lancement.
