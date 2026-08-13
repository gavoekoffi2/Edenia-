# 03 — Parcours utilisateurs

## 1. Le parcours de référence (§62)

L'objectif du §61 : passer de « je découvre EDENIA » à « mon profil est prêt »
avec le minimum de friction. Mesure retenue : **au plus 6 champs obligatoires**
avant d'accéder à la découverte (`productRules.maxRequiredFieldsBeforeDiscovery`).

| # | Étape | Écran | Friction |
|---|---|---|---|
| 1 | Bienvenue | `/` ou `/inscription` | 0 |
| 2 | Téléphone **ou** e-mail | `/inscription` | 1 champ + pays présélectionné |
| 3 | Code à 6 chiffres | `/inscription` | 1 champ |
| 4 | « Parle-moi de toi » | `/app/onboarding` | libre, texte ou voix |
| 5 | Conversation IA | `/app/onboarding` | ≤ 12 tours |
| 6 | « J'ai préparé ton profil » | `/app/onboarding/apercu` | relecture |
| 7 | Correction | idem | à la main, champ par champ |
| 8 | Photo | `/app/profil` | facultative pour publier |
| 9 | Date de naissance, genre, ville | `/app/onboarding/apercu` | 3 champs |
| 10 | Découverte | `/app/decouvrir` | — |

Total des champs strictement obligatoires : **5** (contact, code, date de
naissance, genre + recherche, ville). Tout le reste vient de la conversation.

## 2. Diagramme des états du compte

```
        ┌──────────── inscription (OTP validé)
        ▼
   [ACTIVE, profil non publié]  ──── publication ────►  [ACTIVE, publié]
        │                                                    │
        │                                          signalement confirmé
        │                                                    ▼
        │                                            [RESTRICTED] (7 j)
        │                                                    │
        │                                                    ▼
        │                                            [SUSPENDED] (30 j)
        │                                                    │
        │                                                    ▼
        └──── suppression demandée ──► [DELETED]        [BANNED]
                                        (effacement 30 j)
```

Une suspension ou un bannissement incrémente `sessionVersion` : toutes les
sessions tombent immédiatement.

## 3. Parcours « découvrir → match → rencontre »

```
Découverte ──like──► en attente ──like réciproque──► MATCH
                                                      │
                                                      ├─► Conversation ouverte
                                                      │   + 3 questions de fond (§33)
                                                      │
                                                      ├─► Blocage / signalement
                                                      │   (toujours disponible, gratuit)
                                                      │
                                                      └─► Rendez-vous réel (§41, V2)
                                                          conseils de sécurité
```

Un like sans réciprocité ne notifie pas la personne likée. Notifier reviendrait
à créer une pression, et à ouvrir un canal de contact non consenti.

## 4. Parcours de vérification (§27)

```
Utilisateur : « Vérifier mon profil »
        ▼
VerificationRequest (PENDING) ──► file d'attente back-office
        ▼
Agent : assignation (IN_REVIEW)
        ▼
   ┌────────────────┬─────────────────┐
   ▼                ▼                 ▼
APPROVED       NEED_MORE_INFO     REJECTED
   │                │                 │
badge posé     message à       message motivé
+ TrustSignal  l'utilisateur   à l'utilisateur
   │                                  │
   └──── pièces détruites ≤ 7 jours ──┘
```

L'approbation exige que **tous** les points de la liste soient cochés ; le refus
exige un motif d'au moins 10 caractères. Les deux règles sont appliquées côté
serveur (`validateDecision`), pas seulement dans l'interface.

## 5. Parcours église (§28) — unidirectionnel

```
Utilisateur ──consentement explicite──► EDENIA
                                          │
                            question fermée unique
                                          ▼
                                       Église
                                          │
                              OUI / NON / NE SAIT PAS
                                          ▼
                                       EDENIA ──► badge
```

L'église n'a **aucun** accès en lecture : ni au profil, ni aux matchs, ni aux
messages, ni à la liste de ses membres inscrits. Le consentement est révocable ;
sa révocation fait tomber le badge.

## 6. Parcours de signalement (§34, §35)

```
Signalement (gratuit, 1 geste)
        │
        ├─► TrustSignal (interne, invisible)
        ├─► Report (file de modération, priorisé)
        └─► Confirmation immédiate à la personne qui signale

Détection automatique d'une demande d'argent
        │
        ├─► Avertissement immédiat au destinataire
        ├─► Report créé d'office (on n'attend pas que la personne ose)
        └─► Message marqué pour revue humaine
```

L'expéditeur n'est jamais informé de la détection : le prévenir lui apprendrait
à la contourner.

## 7. Ce qui ne fait volontairement pas partie du parcours

| Écarté | Raison |
|---|---|
| Swipe façon Tinder | §64 : « Tinder avec une identité chrétienne » est explicitement exclu |
| Message payant sans match | Vecteur principal de spam et d'arnaque (M6) |
| Notification « quelqu'un pense à vous » | §46 : pas de fausse notification d'engagement |
| Classement par dernière connexion | Récompense l'assiduité, pas la pertinence |
| Compteurs de membres gonflés | Première entorse à la promesse de confiance |
