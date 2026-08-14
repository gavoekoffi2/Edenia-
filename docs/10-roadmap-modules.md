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
| **M11 — Back-office** | 12 pages, RBAC réel, MFA TOTP, invitations, statistiques et entonnoir | Parcours réel |
| **M12 — PWA** | Manifeste, service worker, page hors ligne, budget perf | Build |
| **M13 — Site public** | 17 pages rédigées, SEO, sitemap, robots | Build |
| **M14 — Photos** | Téléversement, WebP, EXIF/GPS retirés, blurhash, 4 statuts de modération | Parcours réel |
| **M15 — GeniusPay** | Checkout hébergé, webhook signé HMAC, idempotence, machine d'état | 23 tests + parcours |
| **M16 — Lancement gratuit** | Premium éteint, dons sans contrepartie, réglages d'exploitation | 17 tests + parcours |
| **M17 — Sécurité admin** | scrypt, TOTP RFC 6238, codes de secours, élévation, verrouillage | 26 tests + parcours |
| **M18 — Confidentialité** | CSP à nonce, tâche de purge des durées de rétention | Parcours réel |

**178 tests, build de production vert, parcours complet vérifié de bout en bout.**

## 2. Modélisé mais désactivé (feature flags)

`features.video`, `events`, `community`, `academy`, `humanMatchmaking`,
`speedDating`, `churchPartners`, `voiceNotes`, `dateCheck`,
`identityVerificationAdvanced`.

Les entités existent en base pour éviter une migration douloureuse ; seules les
surfaces sont éteintes. Les pages correspondantes annoncent honnêtement leur
disponibilité future plutôt que d'afficher un contenu inventé.

## 3. Ce qui reste à faire

Par ordre de criticité. La distinction compte : la bêta fermée (50 à 100
personnes au Togo, encadrées) et l'ouverture au grand public n'ont pas les mêmes
exigences.

### P0 — Bloquants pour une **ouverture au public**, pas pour la bêta fermée

1. **Passerelle SMS réelle.** `ConsoleSmsProvider` écrit dans la console. En
   bêta fermée le code est `228228`, affiché à l'écran et annoncé comme tel aux
   testeurs. Au public, personne ne pourrait s'inscrire par téléphone — le canal
   principal.
2. **Clés GeniusPay live.** L'intégration est complète et exercée de bout en
   bout (checkout, webhook signé, idempotence, machine d'état) mais en mode
   simulé. Un don réel exige les clés `pk_live_`/`sk_live_` et le secret de
   webhook. Le démarrage en production est bloqué si ces clés manquent.
3. **Modération automatique des images.** Le contrôle actuel ne juge que des
   critères objectifs — dimensions, format, densité — et met les cas douteux en
   `REVIEW_REQUIRED`. Ni nudité, ni violence, ni présence d'un visage : cela
   demande un service de vision. Tenable avec une file humaine sur 100
   personnes, intenable sur 10 000.
4. **Audit externe.** Indispensable avant d'exposer un flux de pièces
   d'identité au grand public.

### Résolus pendant le sprint final

- ~~Téléversement et modération des photos~~ → M14, quatre statuts, EXIF retiré.
- ~~Agrégateur Mobile Money~~ → M15, GeniusPay intégré (`docs/12`).
- ~~Nonces CSP~~ → `src/middleware.ts`, plus aucun `'unsafe-inline'` sur les
  scripts (`docs/09` §5.1).
- ~~Flux TOTP administrateur~~ → M17 (`docs/09` §2.1).
- ~~Tâche de purge~~ → `npm run purge` (`docs/09` §7).

### P1 — Avant la montée en charge

0. **Budget JS non tenu.** 172 ko gzip sur le parcours principal contre 120 ko
   visés (`docs/05` §3), soit ~3,6 s de premier chargement en 3G lente. Le
   surcoût vient du socle React/Next, pas de notre code. Refondre l'application
   pour gagner ces 52 ko juste avant une bêta serait un mauvais échange : on
   remplacerait un problème mesuré par un risque de régression non mesuré. À
   traiter quand le produit sera stable, par du rendu sans hydratation sur les
   pages publiques.
5. Fournisseur STT en production. Le mode vocal repose aujourd'hui sur la Web
   Speech API du navigateur : il n'est donc **pas universel**, et l'interface le
   dit désormais explicitement au lieu de masquer le bouton en silence.
6. Bascule PostgreSQL. Auditée et sans obstacle (`docs/02` §6) ; volontairement
   reportée après la bêta.
7. Envoi différé des messages (Background Sync) pour les connexions instables.
8. Tests d'intégration automatisés sur le parcours complet — il est aujourd'hui
   vérifié manuellement (script reproductible), pas en intégration continue.
9. Mesure d'audience anonyme. Sans elle, la première marche de l'entonnoir
   (« Visite ») reste affichée comme **non mesurée** — jamais remplie par une
   estimation.
10. Limitation de débit dans un store partagé plutôt qu'en base.

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
