# 13 — Lancement gratuit, dons, et bêta fermée

## 1. La décision

EDENIA ouvre **gratuitement**. Pas d'abonnement, pas de fonctionnalité
réservée, pas de badge à acheter. La plateforme est financée par des dons
volontaires qui n'ouvrent aucun droit.

Ce n'est pas une promotion de lancement déguisée. Une phrase du type « Premium
arrivera bientôt » suffirait à faire hésiter quelqu'un à s'inscrire aujourd'hui,
et la page tarifs ne la contient pas.

## 2. Comment c'est implémenté

`MONETIZATION_MODE` — `free` (défaut), `donations`, ou `premium`.

Le défaut est `free` : un oubli de configuration ne peut pas facturer quelqu'un
par accident.

Le code Premium n'est **pas supprimé**, il est éteint. Trois portes :

| Porte | Fichier | Effet en mode gratuit |
|---|---|---|
| Capacités | `src/lib/premium/entitlements.ts` | `hasCapability` rend toujours `true` |
| Interface | `premiumIsPublic` | `/app/premium` renvoie 404, les mentions disparaissent |
| Serveur | `POST /api/v1/payments` | 403 — cacher un bouton n'empêche personne d'appeler l'API |

`hasCapability`, `dailyLikeLimit` et `railLimit` prennent un dernier paramètre
`freeLaunch` avec valeur par défaut. Il n'est jamais passé en production : il
existe pour que les tests vérifient **les deux** régimes. Sans lui, la grille
Premium deviendrait invisible aux tests, et personne ne s'apercevrait qu'elle a
été cassée le jour où on la rallume.

Rallumer Premium : `MONETIZATION_MODE=premium` et un redémarrage. Aucune
migration, aucun écran à réécrire.

## 3. Les dons

`Donation` et `DonationTransaction` sont deux tables **sans aucun lien** avec
`Subscription`, `Payment` ou la vérification. Le module `src/lib/donations/`
n'importe jamais `activateSubscription`.

Ce qu'un don confirmé déclenche, en totalité : une notification de
remerciement. Vérifié bout en bout sur un don réel de 2 000 FCFA — zéro
abonnement, zéro vérification, zéro signal de confiance, trust score inchangé.

```
DONATION_GRANTS_NOTHING = [
  badge, verification, visibility, matching-boost,
  priority-support, extra-likes, premium-features, profile-ranking
]
```

Cette liste est testée. Ajouter un avantage ferait échouer la suite — c'est
exactement l'effet recherché.

### Mécanique d'encaissement

Les dons partagent avec les abonnements la machine d'état, la vérification de
signature HMAC et l'idempotence — la mécanique bancaire est la même, il serait
absurde de l'écrire deux fois. L'aiguillage se fait dans la route webhook sur le
préfixe de la référence de commande (`DON-` contre `EDN-`), qui fait partie de
la charge utile signée et n'est donc pas falsifiable.

Un don peut être fait **sans compte**. La route est limitée par IP (10 par
heure), sinon elle deviendrait un moyen gratuit de créer des lignes en base.

## 4. Le back-office

### Pages

| Page | Permission | Contenu |
|---|---|---|
| `/admin` | `analytics.read` | KPI, DAU/WAU/MAU, entonnoir, taux, charge |
| `/admin/utilisateurs` | `users.read` | Recherche, filtres, suspension, bannissement |
| `/admin/profils` | `photos.moderate` | File photo, doutes en priorité |
| `/admin/verification` | `verification.read` | Dossiers de vérification |
| `/admin/moderation` | `reports.read` | Signalements et sanctions |
| `/admin/dons` | `donations.read` | Suivi financier des dons |
| `/admin/paiements` | `payments.read` | Transactions GeniusPay |
| `/admin/pays` | `countries.manage` | Statut éditorial par pays |
| `/admin/administrateurs` | `admins.manage` | Équipe interne, invitations |
| `/admin/journal` | `audit.read` | Audit pseudonymisé + décisions nominatives |
| `/admin/parametres` | `settings.read` | Réglages d'exploitation |
| `/admin/services` | `analytics.read` | État des services externes |

Un rôle qui n'a pas `analytics.read` n'atterrit pas sur un refus : `/admin`
l'envoie sur la première section qu'il peut réellement ouvrir. Un test vérifie
que ce point de chute existe pour **chaque** rôle.

### Statistiques

DAU / WAU / MAU et DAU÷MAU (régularité d'usage). Taux de publication,
complétude moyenne, taux de matching, conversation après match, et
**réciprocité** — la part des matchs où les deux personnes ont écrit. Un match
où une seule personne parle n'est pas une conversation.

### L'entonnoir, et la marche manquante

Visite → Inscription → Profil commencé → Profil terminé → Photo → Publié →
Premier like → Premier match → Première conversation.

**« Visite » s'affiche comme « non mesuré »**, pas comme un zéro. Nous n'avons
pas de mesure d'audience anonyme : pas de tag analytique, pas de compteur de
pages retenu (§47, minimisation). Remplir cette marche avec le nombre
d'inscrits donnerait un taux de conversion de 100 % — flatteur et faux. Une
étape non instrumentée est rendue comme telle, avec son motif.

### Les quatre réglages, et ce qu'ils font vraiment

Un interrupteur qui ne coupe rien est pire que pas d'interrupteur : on croit
avoir agi. Chacun a donc été vérifié en conditions réelles.

| Réglage | Effet vérifié |
|---|---|
| Inscriptions ouvertes | Création de compte refusée ; **un membre existant se connecte toujours** |
| Découverte ouverte | Page en pause **et** `POST /api/v1/likes` → 503 ; les messages restent ouverts |
| Dons ouverts | `/soutenir` → 404 et `POST /api/v1/donations` → 403 |
| Bandeau | Affiché en tête de l'application ; vide = rien |

Le contrôle des inscriptions est placé au moment de la **création du compte**,
pas à la demande du code. Refuser un code aux seules destinations inconnues
transformerait l'écran de connexion en oracle : « ce numéro est-il membre
d'EDENIA ? » se lirait dans la réponse. Au moment de la création, l'appelant
possède déjà le code envoyé à cette destination — il n'apprend rien.

### Réglages : deux natures, et pourquoi

**En base** (effet immédiat, sans redéploiement) : inscriptions ouvertes,
découverte ouverte, dons ouverts, bandeau d'information. Ce sont des décisions
d'exploitation qui se prennent en minutes.

**Dans l'environnement** (lecture seule dans l'interface) : mode de
monétisation, mode d'authentification, agrégateur de paiement, fournisseur IA,
stockage. Ces valeurs engagent de l'argent ou la sécurité des comptes ; les
mettre à portée d'un clic dans une interface web serait une faiblesse, pas un
confort.

La page de réglages affiche les deux, côte à côte, avec la variable à changer.
Sans cela, la scène est toujours la même : quelqu'un cherche vingt minutes
pourquoi un interrupteur n'a aucun effet.

### Statuts de modération photo

`PENDING` · `APPROVED` · `REJECTED` · `REVIEW_REQUIRED`

La distinction entre les deux derniers compte. `REJECTED` sanctionne un critère
objectif — inutile de faire regarder une image de 80 pixels par un humain.
`REVIEW_REQUIRED` signale un doute et passe **en priorité** devant un humain :
c'est une file distincte, pas la queue normale. Les fusionner reviendrait à
noyer les cas douteux dans le volume, c'est-à-dire à les traiter en dernier.

Un modérateur qui hésite peut aussi passer la main (« Je préfère passer la
main »), avec un motif obligatoire. Forcer un choix binaire produit des
décisions arbitraires ; autoriser le doute produit de meilleures décisions.

## 5. Audit PostgreSQL

Vérifié, pas supposé : le schéma bascule sur `provider = "postgresql"` et
`prisma migrate diff` génère **58 tables et 95 index sans une seule erreur**.

Aucun obstacle : pas d'enum Prisma, pas de tableau natif, pas de type `@db.`
spécifique, pas de `mode: "insensitive"` dans le code.

**Décision : ne pas migrer avant la bêta fermée.** Pour 50 à 100 personnes,
SQLite tient largement, et la migration introduirait un composant de plus à
opérer au moment précis où l'attention doit aller aux utilisateurs. La bascule
est prête, elle attend le volume qui la justifie.

Une seule différence de comportement à connaître : `contains` est
insensible à la casse sur SQLite pour l'ASCII, sensible sur PostgreSQL. Cela
n'affecte que la recherche du back-office ; le jour de la bascule, ajouter
`mode: "insensitive"` dans `/admin/utilisateurs` suffit.

## 6. Bêta fermée : ce qui reste simulé

Trois choses, à dire aux testeurs sans détour :

| Service | État | Conséquence pour le testeur |
|---|---|---|
| SMS / e-mail | Simulé | Le code de vérification est `228228`, affiché à l'écran |
| Paiement | Simulé | Aucun débit réel, même sur un don |
| Modération d'image | Partielle | Critères objectifs seulement, revue humaine derrière |
| Mode vocal | Partiel | Dépend du navigateur ; repli écrit explicite |

Le bandeau « MODE DÉVELOPPEMENT » du back-office les liste en permanence.
`AUTH_MODE=development` **fait échouer le démarrage** en production.
