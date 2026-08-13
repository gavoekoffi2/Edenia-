# 10 — Feuille de route par modules

Le §66 demande de construire par modules fonctionnels, testés, sans casser les
précédents. Voici l'état réel.

## 1. Livré et vérifié

| Module | Périmètre | Vérification |
|---|---|---|
| **M0 — Socle** | Configuration validée, feature flags, règles produit du §60 en constantes | Build + typecheck |
| **M1 — Matching** | 7 dimensions, poids adaptatifs, critères essentiels bilatéraux, explication filtrée par visibilité | 21 tests |
| **M2 — EDENIA AI** | Contrat d'extraction fermé, ancrage §13, interdits §40, moteur d'onboarding, génération §15, 2 fournisseurs | 30 tests |
| **M3 — Données** | 50 entités, portable SQLite/PostgreSQL, seed de 15 pays et 10 profils | `db:reset` |
| **M4 — Sécurité** | OTP, sessions, RBAC, chiffrement, limitation de débit, frontière de confidentialité | 36 tests |
| **M5 — Authentification** | Téléphone **ou** e-mail, format local, écrans complets | Parcours réel |
| **M6 — Onboarding** | Chat texte/voix, relecture et correction, publication explicite | Parcours réel |
| **M7 — Découverte** | 6 rails, score + explication systématiques, quotas | Parcours réel |
| **M8 — Social** | Likes, matchs, chat, questions de fond, blocage, signalement | Parcours réel |
| **M9 — Confiance** | 5 niveaux, demande gratuite, consentement église explicite | Parcours réel |
| **M10 — Premium** | Entitlements, offres calées sur le pouvoir d'achat, couche de paiement | Parcours réel |
| **M11 — Back-office** | Tableau de bord (KPI §53 en tête), vérification, modération | Parcours réel |
| **M12 — PWA** | Manifeste, service worker, page hors ligne, budget perf | Build |
| **M13 — Site public** | 16 pages rédigées, SEO, sitemap, robots | Build |

**87 tests, build de production vert, parcours complet vérifié de bout en bout.**

## 2. Modélisé mais désactivé (feature flags)

`features.video`, `events`, `community`, `academy`, `humanMatchmaking`,
`speedDating`, `churchPartners`, `voiceNotes`, `dateCheck`,
`identityVerificationAdvanced`.

Les entités existent en base pour éviter une migration douloureuse ; seules les
surfaces sont éteintes. Les pages correspondantes annoncent honnêtement leur
disponibilité future plutôt que d'afficher un contenu inventé.

## 3. Ce qui reste à faire avant une ouverture au public

Par ordre de criticité :

### P0 — Bloquants

1. **Téléversement et modération des photos.** Le modèle `Photo` existe, la
   frontière de sérialisation filtre déjà les photos non approuvées, mais le
   flux de téléversement, le redimensionnement AVIF/WebP, le calcul du blurhash
   et le contrôle automatique ne sont pas écrits. Sans photos, la découverte
   n'a pas de sens.
2. **Agrégateur Mobile Money réel.** L'interface `PaymentProvider` et le
   catalogue par pays sont prêts ; l'adaptateur est simulé. Il faut un contrat
   avec un agrégateur, puis implémenter `initiate`, `checkStatus`,
   `verifyWebhook` et la route de webhook.
3. **Passerelle SMS réelle.** `ConsoleSmsProvider` écrit dans la console.
   Sans SMS, personne ne peut s'inscrire par téléphone — le canal principal.
4. **Sécurité** : nonces CSP, flux TOTP administrateur, tâche de purge des
   données. Voir `docs/09` §6.

### P1 — Avant la montée en charge

5. Fournisseur STT en production (l'interface est prête, le mode vocal repose
   aujourd'hui sur la Web Speech API du navigateur).
6. Bascule PostgreSQL + index de recherche (`docs/02` §6).
7. Envoi différé des messages (Background Sync) pour les connexions instables.
8. Tests d'intégration automatisés sur le parcours complet — il est aujourd'hui
   vérifié manuellement (script reproductible), pas en intégration continue.
9. Instrumentation analytique du §53 (entonnoir inscription → profil → like →
   match → message → réponse).

### P2 — V2 / V3 (§57, §58)

Vérification d'identité avancée, réseau d'églises partenaires, EDENIA Events,
Community, Academy, notes vocales, vidéo, matchmaking humain, applications
natives, expansion panafricaine.

## 4. Stratégie de déploiement géographique (§4)

Un seul pays ouvert à la fois (`Country.isLaunched`). Le tableau de bord affiche
la densité par pays. Critère de passage au marché suivant, à valider par
l'équipe produit : une masse critique de profils publiés et actifs dans la ville
pilote, avec un ratio hommes/femmes tenable.

Ordre prévu : Togo (Lomé) → Bénin → Côte d'Ivoire → Cameroun → Sénégal → RDC →
Burkina Faso → Guinée → Congo → Gabon → Mali → Niger.

## 5. Le risque numéro un, et ce qui a été fait

Le déséquilibre hommes/femmes tue la plupart des plateformes de rencontre en
phase pilote. Mesures déjà en place :

- plafond de likes **pour tous**, pas seulement pour les gratuits ;
- découverte pilotée par la compatibilité, jamais par la récence ;
- pas de message payant sans match — supprime le harcèlement par volume ;
- lancement par vagues géographiques ;
- recrutement initial via les églises partenaires, qui apportent des cohortes
  naturellement mixtes.

Ce qui reste à faire : suivre le ratio par ville dans le tableau de bord, et
s'interdire d'ouvrir un marché tant qu'il est trop déséquilibré.
