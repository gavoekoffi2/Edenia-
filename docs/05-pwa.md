# 05 — Architecture PWA et performance

Références : `public/manifest.webmanifest`, `public/sw.js`, `next.config.ts`.

## 1. Pourquoi la PWA d'abord (§5)

Sur les marchés cibles, l'installation depuis un magasin d'applications coûte
cher : découverte, données mobiles, espace de stockage sur un téléphone d'entrée
de gamme, et souvent un compte Google inutilisé. La PWA supprime tout cela — un
lien suffit — tout en permettant l'ajout à l'écran d'accueil.

L'architecture n'empêche rien pour la suite : l'API `/api/v1/**` est sans état
et versionnée, prête pour les applications natives de la V3 (§58).

## 2. Stratégies de cache

| Ressource | Stratégie | Justification |
|---|---|---|
| Coque, CSS, JS | Cache-first | Ne repart jamais sur le réseau une fois posée |
| Navigations | Network-first, repli `/hors-ligne` | Sur une 3G qui coupe, un message honnête vaut mieux qu'un onglet blanc |
| Images | Stale-while-revalidate, plafonné à 60 entrées | Économise la data sans saturer le stockage |
| **`/api/**`** | **Jamais de cache** | Un profil ou un message servi périmé serait pire qu'une erreur — et ce sont des données personnelles (§47) |

Ce dernier point est une décision de confidentialité autant que de fraîcheur :
aucune donnée personnelle ne doit se retrouver dans un cache persistant sur un
téléphone potentiellement partagé.

## 3. Budget de performance (§45)

| Métrique | Cible | Mesure |
|---|---|---|
| First Load JS, parcours principal | < 120 ko | `next build` |
| LCP en 3G simulée | < 2,5 s | Lighthouse, throttling « Slow 4G » |
| CSS total | < 20 ko | Tailwind purgé |
| Polices | **0 ko** | Stack système |
| Images de profil | ≤ 80 ko en AVIF/WebP | Redimensionnement au téléversement |

Moyens :
- rendu serveur pour les pages publiques (SEO + premier octet rapide) ;
- `next/image` avec AVIF/WebP et `deviceSizes` calés sur les petits écrans
  (320 → 1280 px, pas de 1920) ;
- chargement paresseux systématique des images secondaires ;
- `blurhash` stocké en base : un aperçu progressif sans requête supplémentaire ;
- pagination partout, jamais de liste complète ;
- squelettes plutôt que spinners.

## 4. Notifications (C9)

Sur iOS, les Web Push n'arrivent que si la PWA a été ajoutée à l'écran
d'accueil (iOS 16.4+). Le push est donc traité comme un simple **transport** :

```
Événement réel → Notification en base (source de vérité)
                      │
                      ├─ Web Push si abonnement disponible
                      ├─ sinon e-mail si vérifié, et si l'événement le mérite
                      ├─ sinon SMS — réservé à la sécurité (coût réel)
                      └─ dans tous les cas : boîte in-app
```

`NOTIFIABLE_EVENTS` est une liste fermée : un événement absent ne peut pas
déclencher de notification. C'est ce qui rend impossible, structurellement, la
fausse notification d'engagement interdite par le §46.

## 5. Hors ligne

Ce qui fonctionne sans réseau : la coque, les pages publiques déjà visitées, la
page `/hors-ligne`.

Ce qui ne fonctionne pas, volontairement : la découverte, les messages, le
profil. Servir un profil périmé induirait en erreur — un match affiché hors
ligne peut avoir été bloqué entre-temps.

**Point non résolu** : la file d'envoi différé des messages (Background Sync)
n'est pas implémentée. Sur une connexion instable, un message échoué est
actuellement restitué dans le champ de saisie plutôt que perdu — acceptable pour
le MVP, à améliorer en V2.

## 6. Installation

`beforeinstallprompt` n'est pas détourné : l'invite d'installation du navigateur
est laissée telle quelle. Une bannière « Installez notre app ! » au premier
écran est une friction avant même que l'utilisateur sache ce qu'est EDENIA.
