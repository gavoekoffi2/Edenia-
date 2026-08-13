# 00 — Analyse critique du cahier des charges

Ce document est la première étape demandée au §66 : analyser le cahier des charges et
identifier les contradictions **avant** de coder. Chaque point liste le conflit, puis
l'arbitrage retenu et implémenté dans le code.

---

## 1. Contradictions et tensions identifiées

### C1 — « Jamais téléphone + email » vs. niveaux de vérification et notifications

- §8 et §60 : « Ne jamais exiger simultanément téléphone + email ».
- §26 : deux niveaux distincts « Téléphone vérifié » et « Email vérifié ».
- §46 : notifications par SMS **et** email.

**Conflit.** Si un utilisateur s'inscrit par téléphone uniquement, il ne peut jamais
atteindre le niveau « Email vérifié », ni recevoir d'email.

**Arbitrage retenu.** Un seul canal vérifié est requis pour créer et utiliser le compte.
Le second canal est un *ajout facultatif* qui augmente le niveau de confiance et ouvre un
canal de notification supplémentaire. Aucune fonctionnalité du MVP n'est conditionnée à la
possession des deux. Les notifications sont routées vers les canaux **disponibles**
(`NotificationLayer` choisit web push → canal vérifié → rien).

---

### C2 — Premium « donne accès aux profils vérifiés » vs. « ne jamais vendre la vérité »

- §31 et §43 : Premium donne accès aux « profils vérifiés ».
- §31 et §60 : « Ne jamais vendre la vérité », « ne jamais vendre le badge ».
- §30 : le badge doit être affiché sur les profils.

**Conflit.** Si les profils vérifiés ne sont visibles que par les Premium, la sécurité
devient payante — ce que le §60 interdit dans l'esprit.

**Arbitrage retenu.** Distinction stricte entre trois choses :

| Objet | Gratuit | Premium |
|---|---|---|
| **Badge de vérification** affiché sur un profil | ✅ toujours visible | ✅ |
| **Filtre** « uniquement les profils vérifiés » | ❌ | ✅ |
| **Rail de découverte** « 🛡️ Profils vérifiés » (§23) | aperçu limité (3/jour) | illimité |
| **Demander sa propre vérification** | ✅ toujours gratuit | ✅ |
| **Signaler / bloquer / avertissements anti-arnaque** | ✅ toujours gratuit | ✅ |

Règle codée dans `src/lib/premium/entitlements.ts` : *aucune capacité de sécurité n'est
derrière le paywall*. Premium ne vend que de la **commodité** (filtres, tri, volume,
visibilité), jamais de la **vérité** ni de la **protection**.

---

### C3 — Le badge de confiance public vs. le Trust Score interne

- §30 : afficher un badge de confiance.
- §34 : « Créer un Trust Score interne uniquement pour les systèmes de
  sécurité/modération. Ne pas afficher publiquement un score de réputation négatif. »

**Arbitrage retenu.** Deux objets qui ne se croisent jamais dans l'API publique :

- `VerificationBadge` — **factuel, public, binaire par niveau** (« Identité vérifiée »).
  Sérialisé par `toPublicProfile()`.
- `TrustSignal[]` + `trustScore` — **probabiliste, privé**, jamais sérialisé côté client.
  Un test (`tests/privacy.test.ts`) échoue si `trustScore` fuit dans une réponse publique.

---

### C4 — Le matching affiche « Localisation 96 % » vs. « ne jamais afficher l'adresse exacte »

- §20 : dimension « Localisation : 96 % ».
- §24 : « Ne jamais afficher l'adresse exacte ».

**Arbitrage retenu.** Le score de localisation est calculé côté serveur à partir de la
**hiérarchie administrative** (pays → région → ville) et jamais de coordonnées GPS
précises. La granularité maximale stockée est la ville ; les distances affichées sont
arrondies par paliers (« même ville », « à moins de 25 km », « même région »).

---

### C5 — « Points à découvrir » peut divulguer les réponses privées d'autrui

- §21 : « Vous n'avez pas encore indiqué la même préférence concernant le lieu de
  résidence après mariage. »

**Conflit avec §47 et §60** (« ne jamais exposer publiquement des informations privées ») :
cette phrase révèle indirectement la réponse de l'autre personne.

**Arbitrage retenu.** L'explication de match n'utilise que les dimensions que **les deux
utilisateurs ont rendues visibles**. Pour une dimension privée, la formulation devient
neutre et non informative (« C'est un sujet que vous pourriez aborder ensemble »). Encodé
dans `explainMatch()` via le paramètre `visibility`.

---

### C6 — Données religieuses sensibles : cœur du produit vs. minimisation

- §17 : dénomination, église, ministère, engagement, fréquence, prière, lecture biblique.
- §28 et §47 : « Ne pas collecter inutilement des informations religieuses sensibles »,
  « collecter uniquement les données nécessaires ».

**Tension réelle et inévitable.** La conviction religieuse est une donnée sensible (RGPD
art. 9 ; loi togolaise n°2019-014 relative à la protection des données à caractère
personnel). Elle est pourtant la raison d'être du produit.

**Arbitrage retenu — 5 garde-fous :**

1. **Base légale = consentement explicite, séparé et granulaire**, recueilli à
   l'onboarding (`Consent` avec `purpose = FAITH_PROFILE`), révocable.
2. **Minimisation dans la vérification église** : l'église répond `oui / non / ne sait
   pas` à une question fermée. Elle ne transmet aucun autre élément, ne reçoit pas le
   profil, et ne voit jamais la liste de ses membres inscrits sur EDENIA.
3. **Champs sensibles chiffrés au repos** (`src/lib/crypto/field.ts`, AES-256-GCM,
   enveloppe de clé applicative).
4. **Visibilité réglable par champ** : `FaithProfile.visibility` permet de masquer la
   dénomination tout en restant matchable dessus (le calcul est serveur-side).
5. **Purge** : suppression de compte = suppression réelle des données sensibles sous 30 j
   (les logs d'audit conservent seulement des identifiants pseudonymisés).

---

### C7 — L'église partenaire ne doit pas contrôler l'utilisateur

- §29 : l'église peut « confirmer certains profils avec consentement ».
- §29 : « L'église ne doit jamais pouvoir contrôler les choix amoureux de l'utilisateur. »

**Arbitrage retenu.** Le flux de vérification église est **unidirectionnel et initié par
l'utilisateur** :

```
Utilisateur → demande → EDENIA (agent) → question fermée → Église → oui/non → EDENIA
```

L'église ne dispose d'aucun accès en lecture aux profils, aux matchs ou aux messages.
Le tableau de bord `EDENIA for Churches` (V2) expose uniquement : la page publique de
l'église, ses événements, et une file de demandes de confirmation **nominatives et
consenties**. Consentement révocable à tout moment → le badge « Église vérifiée » tombe.

---

### C8 — Mode vocal : hypothèse technique non tenable telle quelle

- §12 : microphone intégré, voix → transcription.

**Contrainte réelle.** La Web Speech API n'est pas disponible sur tous les navigateurs
cibles (absente de Firefox Android, incohérente sur WebView Android bas de gamme, exige
un accès réseau chez le fournisseur du navigateur). Sur des connexions 3G instables (§45),
l'upload d'un audio brut est coûteux.

**Arbitrage retenu.** Trois niveaux dégradés, dans cet ordre :

1. **Transcription serveur** (`SpeechProvider` abstrait) sur un audio Opus compressé
   (~16 kbps mono) — le mode nominal.
2. **Web Speech API** si disponible et si l'utilisateur préfère (aucun upload audio).
3. **Saisie texte** — *toujours* proposée, jamais masquée. Le §60 impose l'absence de
   friction : le vocal est un accélérateur, jamais un passage obligé.

L'audio brut est supprimé après transcription ; seul le texte est conservé.

---

### C9 — Notifications push sur iOS

- §46 : notifications push ; §5 : cible iPhone/iPad.

**Contrainte réelle.** Sur iOS, les Web Push ne fonctionnent que si la PWA a été ajoutée à
l'écran d'accueil (iOS 16.4+). Un utilisateur Safari non installé ne recevra rien.

**Arbitrage retenu.** `NotificationLayer` est multi-canal avec repli automatique :
`webpush → SMS (si téléphone vérifié) → email (si email vérifié) → boîte in-app`. La boîte
in-app est la source de vérité ; le push n'est qu'un transport.

---

### C10 — Âge de la cible

- §3 : « particulièrement pertinent pour les jeunes adultes » + « règles légales d'âge ».

**Arbitrage retenu.** **18 ans minimum, strict**, sans exception, sur tous les marchés
(la majorité matrimoniale varie selon les pays ; 18 est le plancher le plus sûr et le
plus protecteur). Contrôle à l'inscription (date de naissance, pas « âge ») et
re-contrôle lors de la vérification d'identité. Un écart détecté déclenche une suspension
immédiate, pas un simple avertissement.

---

### C11 — Vidéo

- §32 : « éventuellement vidéo plus tard » ; §49 : entité `Video` dans le modèle.

**Arbitrage retenu.** L'entité existe dès le MVP (pour éviter une migration douloureuse),
la fonctionnalité est derrière le feature flag `features.video = false`.

---

## 2. Éléments manquants dans le cahier des charges (décisions à valider)

Ces points ne sont pas tranchés par le cahier des charges. J'ai retenu une valeur par
défaut explicite pour ne pas bloquer le développement ; chacune est un **point de décision
produit** à confirmer.

| # | Sujet | Décision par défaut retenue | Pourquoi |
|---|---|---|---|
| M1 | Genre et recherche | Champs `gender` (`F`/`M`) et `seeking` déclarés par l'utilisateur ; par défaut la recherche cible le sexe opposé, conforme à la finalité mariage du produit (§65). Modélisé comme **donnée**, non codé en dur. | Permet un ajustement produit/juridique par marché sans refonte du moteur. |
| M2 | Langue | Français seul au MVP, mais toutes les chaînes passent par `src/lib/i18n` | Anglais/portugais utiles pour la diaspora en V2. |
| M3 | Rétention des données | Compte inactif 24 mois → notification puis anonymisation. Suppression demandée → 30 j. | Absent du §47, indispensable juridiquement. |
| M4 | Modération des photos | Contrôle automatique (nudité/violence/visage absent) **avant** publication + revue humaine en cas de doute. | §35 mentionne la modération des photos sans définir le moment. |
| M5 | Prix Premium | Ancré sur le coût d'un forfait data mensuel local, pas sur une conversion EUR→FCFA (§43). Cible pilote Togo : 2 000 FCFA/mois, 5 000 FCFA/3 mois. | §43 impose le principe, pas le chiffre. |
| M6 | Réciprocité du chat | Le chat n'est ouvert **qu'après match mutuel** (§32) — pas de message payant non sollicité, même en Premium. | Cohérent avec §34 (anti-arnaque) : supprime le vecteur principal de spam. |
| M7 | Statut matrimonial | Déclaré ; « marié » interdit sur la plateforme, « séparé / divorcé / veuf » autorisés et affichés. | §27 mentionne la vérification du statut matrimonial sans dire ce qui est acceptable. |

---

## 3. Risques produit majeurs

| Risque | Impact | Mitigation retenue |
|---|---|---|
| **Déséquilibre hommes/femmes** (risque n°1 de tout produit de rencontre en phase pilote) | Les femmes reçoivent trop de likes, quittent, le produit meurt | Quota de likes quotidiens **pour tous** ; découverte pilotée par la compatibilité et non par la récence ; lancement par vagues géographiques (§4) ; recrutement initial via les églises partenaires, qui apportent des cohortes mixtes |
| **Faux profils dès le lancement** | Détruit la promesse « confiance » (§65) | Vérification téléphone obligatoire pour liker, empreinte d'appareil, détection de comptes multiples, `TrustSignal` dès le MVP |
| **L'IA invente des données** (§13) | Perte de confiance immédiate, profil faux | Extraction avec `confidence` + `sourceQuote` obligatoires ; tout champ sous le seuil devient `À CONFIRMER` et n'est jamais publié sans validation humaine ; test unitaire dédié |
| **Le score de compatibilité pris pour une vérité** (§21, §60) | Déception, sentiment de tromperie | Score toujours accompagné d'un texte explicatif, arrondi à 5 %, jamais présenté au-delà de 97 %, avec la mention « indicatif » |
| **Coût de l'IA par utilisateur** | Marge négative sur un marché à faible ARPU | Onboarding plafonné (12 tours, ~4 000 tokens) ; extraction en un appel unique ; cache des embeddings ; repli déterministe si le budget est dépassé |

---

## 4. Ce qui est effectivement construit dans cette itération

Conformément au §66 (« Ne développe pas tout en même temps ») et au §59 (priorités) :

- **Livré** : documents d'architecture (docs 01→10), design system, schéma de données
  complet, moteur de matching testé, couche IA testée avec fournisseur de repli,
  authentification OTP, onboarding conversationnel, profil, découverte, likes/matchs,
  chat, demande de vérification, back-office (modération + vérification), couche de
  paiement abstraite, PWA installable, pages publiques SEO.
- **Modélisé mais désactivé** (feature flags) : vidéo, EDENIA Events, Community, Academy,
  matchmaking humain, tableau de bord églises.
- **Hors périmètre de cette itération** : applications natives (V3), intégration réelle
  d'un agrégateur Mobile Money (adaptateur simulé + interface prête), STT en production
  (interface prête, fournisseur simulé).
