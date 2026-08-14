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

## 3. Budget de performance (§45) — mesures réelles

Mesuré sur le build de production, transfert gzip, scripts et styles inclus :

| Page | HTML | JS | CSS | Total | ~3G lente (400 kbit/s) |
|---|---|---|---|---|---|
| `/` (accueil) | 7,4 ko | 171,6 ko | 5,4 ko | **184,3 ko** | ~3,7 s |
| `/inscription` | 3,7 ko | 176,6 ko | 5,4 ko | **185,7 ko** | ~3,7 s |
| `/app/decouvrir` | 3,6 ko | 176,6 ko | 5,4 ko | **185,6 ko** | ~3,7 s |
| `/tarifs` | 6,6 ko | 171,6 ko | 5,4 ko | **183,5 ko** | ~3,7 s |

| Métrique | Cible | Réel | Verdict |
|---|---|---|---|
| JS du parcours principal | < 120 ko gzip | **176 ko** | ❌ **cible non tenue** |
| CSS total | < 20 ko | 5,4 ko | ✅ |
| Polices web | 0 ko | 0 ko | ✅ |
| Photo de profil traitée | ≤ 80 ko | ~1,6 ko (WebP 1080 px) | ✅ |

**Le budget JS n'est pas atteint, et il faut le dire.** Les 176 ko sont
essentiellement le socle React 19 + Next.js 16 : nos propres composants pèsent
peu, et les pages sont déjà majoritairement des composants serveur. Descendre
sous 120 ko demanderait de sortir du framework sur les pages publiques (rendu
statique sans hydratation), pas de retoucher notre code.

Décision retenue : on assume ~3,7 s de premier chargement en 3G lente, en
notant que la coque est ensuite mise en cache par le service worker et que les
visites suivantes ne rechargent pas ce socle. Le point est inscrit comme
chantier P1 dans `docs/10`.

Ce qui a bien fonctionné : le refus des polices web (0 ko au lieu de 150-250 ko)
et le traitement des photos — une image de 1400 × 1000 pixels descend à 1,6 ko.

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
