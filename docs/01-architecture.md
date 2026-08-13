# 01 — Architecture technique

## 1. Principes directeurs

1. **Africa-first, pas « traduit »** — chaque décision technique est évaluée sur un
   Android d'entrée de gamme en 3G (§7, §45).
2. **Modules remplaçables** — IA, paiement, SMS, stockage et STT sont derrière des
   interfaces. Aucun code métier n'importe un SDK fournisseur (§48).
3. **Le métier ne vit pas dans les composants React** — toute la logique est dans
   `src/lib/**`, testable sans navigateur ni base de données.
4. **Le web est le produit, pas un tremplin** — PWA d'abord ; l'API est déjà découplée
   pour que des clients natifs s'y branchent en V3 (§5).

## 2. Pile retenue

| Couche | Choix | Justification |
|---|---|---|
| Frontend | **Next.js 16 (App Router) + React 19** | Rendu serveur pour le SEO des pages publiques (§54), streaming utile en 3G, un seul déploiement pour le site public et l'app. |
| Styles | **Tailwind CSS v4** | Pas de runtime CSS-in-JS, CSS final minuscule — critique en 3G. Les tokens du design system sont des variables CSS natives. |
| API | **Route Handlers Next.js** (`src/app/api/**`) | Contrat HTTP/JSON stable et versionnable (`/api/v1/**`), consommable plus tard par les apps natives. |
| ORM | **Prisma 6** | Schéma unique déclaratif, migrations, typage strict. |
| Base | **SQLite en dev, PostgreSQL en production** | Voir §4 ci-dessous. |
| Sessions | **JWT signé (jose) en cookie `HttpOnly`** | Pas de dépendance à un store de sessions au MVP ; révocation par `sessionVersion` en base. |
| Validation | **Zod 4** | Toute entrée réseau est validée en frontière ; les types métier en dérivent. |
| Tests | **Vitest** | Cible la logique pure (matching, IA, entitlements, confidentialité). |

**Aucune dépendance UI lourde** (pas de librairie de composants, pas de framework
d'animation, pas de client d'état global). Budget initial : voir `docs/05-pwa.md`.

## 3. Découpage en modules

```
src/lib/
├── db/               Client Prisma + helpers de sérialisation publique
├── auth/             OTP, sessions, RBAC, limitation de débit
├── ai/               Couche IA : provider, onboarding, extraction, génération, garde-fous
│   ├── provider.ts       interface AiProvider (indépendante du fournisseur)
│   ├── providers/        anthropic.ts | rulebased.ts (repli déterministe)
│   ├── onboarding.ts     machine à états de la conversation
│   ├── extraction.ts     texte → données structurées + confiance + citation
│   └── guardrails.ts     interdits du §40, règle « ne jamais inventer » du §13
├── matching/         Moteur de compatibilité (pur, sans I/O)
│   ├── dimensions.ts     les 7 dimensions du §20
│   ├── score.ts          calcul et pondération
│   ├── dealbreakers.ts   critères essentiels vs préférences (§22)
│   └── explain.ts        texte d'explication (§21)
├── verification/     Dossiers, niveaux, badges (§25-§30)
├── trust/            Signaux anti-arnaque, trust score interne (§34)
├── payments/         Interface PaymentProvider + adaptateurs Mobile Money (§42)
├── notifications/    Routage multi-canal avec repli (§46)
├── geo/              Afrique → pays → région → ville (§24)
├── premium/          Entitlements (§31, §43)
├── moderation/       File de signalements, échelle de sanctions (§35)
└── config/           Feature flags, constantes produit
```

**Règle de dépendance** : `app/ → lib/<module>/ → lib/db/`. Un module métier n'importe
jamais un autre module métier de même niveau ; les orchestrations vivent dans les Route
Handlers ou les Server Actions.

## 4. Base de données : SQLite en dev, PostgreSQL en production

Le schéma Prisma est écrit **portablement** :

- pas d'`enum` Prisma (on utilise `String` + constantes TypeScript validées par Zod) ;
- pas de tableaux natifs (on utilise des tables de jointure ou du JSON sérialisé) ;
- pas de types spécifiques Postgres au MVP.

Conséquence : `provider = "sqlite"` en développement (l'application démarre et se teste
sans serveur externe, ce qui compte dans un contexte de connectivité faible), et bascule
en `provider = "postgresql"` en production en changeant **une ligne** + `DATABASE_URL`.

Ce qui change à la bascule (documenté dans `docs/02-modele-de-donnees.md` §6) :
recherche plein texte, index `GIN` pour la découverte géographique, et pooling.

## 5. Flux de données principaux

### Inscription et onboarding

```
Client ──POST /api/v1/auth/otp/request───────► RateLimiter → OtpService → SmsProvider
       ◄─ { challengeId }
Client ──POST /api/v1/auth/otp/verify────────► OtpService → SessionService
       ◄─ Set-Cookie: edenia_session (HttpOnly, SameSite=Lax, Secure)
Client ──POST /api/v1/onboarding/message─────► OnboardingEngine
                                                 ├─► AiProvider.chat()      (question suivante)
                                                 └─► AiProvider.extract()   (champs + confiance)
       ◄─ { reply, extracted[], progress, done }
Client ──POST /api/v1/onboarding/confirm─────► ProfileService.applyDraft()  (§14 validation humaine)
```

### Découverte et matching

```
GET /api/v1/discover?rail=for-you
  → CandidateQuery (filtres durs : géo, âge, genre, actif, non bloqué, non déjà vu)
  → Dealbreakers.filter()          (§22 critères essentiels, éliminatoires)
  → MatchScore.compute()           (§20 sept dimensions pondérées)
  → Explain.build()                (§21, filtré par visibilité — cf. C5)
  → toPublicProfile()              (§30, §47 : jamais de trustScore ni de données privées)
```

## 6. Sécurité — vue d'ensemble

| Menace | Contre-mesure | Emplacement |
|---|---|---|
| Bourrage d'OTP | 5 tentatives / challenge, 3 challenges / heure / numéro, code haché (SHA-256 + sel) | `lib/auth/otp.ts` |
| Vol de session | JWT `HttpOnly` + `Secure` + `SameSite=Lax`, TTL 30 j, `sessionVersion` pour révocation globale | `lib/auth/session.ts` |
| Élévation de privilèges | RBAC explicite, refus par défaut, vérifié dans chaque handler admin | `lib/auth/rbac.ts` |
| Énumération d'utilisateurs | Réponse identique que le compte existe ou non ; délai constant | `api/v1/auth/**` |
| Fuite de données privées | Sérialiseur unique `toPublicProfile()` + test de non-régression | `lib/db/serialize.ts` |
| Arnaque financière | Détection de motifs (§34), avertissement in-chat, `TrustSignal` | `lib/trust/**` |
| Comptes multiples | Empreinte d'appareil + numéro + heuristiques | `lib/trust/signals.ts` |
| Données sensibles au repos | AES-256-GCM sur les champs identité/documents | `lib/crypto/field.ts` |
| MFA administrateurs | TOTP obligatoire pour tout rôle ≥ `MODERATOR` | `lib/auth/mfa.ts` |

## 7. Environnements et configuration

Toute la configuration passe par des variables d'environnement validées au démarrage
(`src/lib/config/env.ts`, schéma Zod — l'application refuse de démarrer si une variable
requise en production manque). Aucun secret n'est jamais exposé côté client ; seules les
variables `NEXT_PUBLIC_*` traversent la frontière.

En développement, **aucun service externe n'est requis** : les fournisseurs SMS, IA,
paiement et STT ont chacun une implémentation locale déterministe. C'est ce qui permet de
lancer et tester la totalité du parcours hors ligne.

## 8. Évolution vers les applications natives (V3)

L'API `/api/v1/**` est déjà :

- sans état (JWT porteur, cookie *ou* en-tête `Authorization`) ;
- versionnée ;
- indépendante du rendu (aucune Server Action dans le chemin critique métier).

Un client natif consommera les mêmes routes. La logique métier de `src/lib/**` est du
TypeScript pur et pourra être extraite en paquet partagé sans réécriture.
