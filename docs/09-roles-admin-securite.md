# 09 — Rôles administrateurs, sécurité et confidentialité

## 1. Rôles (§36, §50, §51)

Principe : **refus par défaut**. Une permission absente de la liste d'un rôle
est refusée, sans héritage implicite.

| Rôle | Périmètre |
|---|---|
| `USER` | Aucune permission d'administration |
| `SUPPORT` | Lecture seule : utilisateurs, signalements, dossiers |
| `ANALYST` | Statistiques agrégées uniquement |
| `VERIFIER` | Dossiers de vérification, pièces, églises. **Ni conversations, ni paiements, ni bannissement** |
| `MODERATOR` | Signalements, sanctions jusqu'à la suspension, photos, messages signalés. **Pas les pièces d'identité** |
| `ADMIN` | Tout sauf gestion des administrateurs et remboursements |
| `SUPER_ADMIN` | Tout |

Les deux séparations importantes :
- un **modérateur** ne voit pas les pièces d'identité ;
- un **agent de vérification** ne voit pas les conversations.

Chacun a besoin de données sensibles, mais pas des mêmes. Croiser les deux
accès dans un seul rôle créerait un point de compromission unique.

`VERIFICATION_AGENT` était le code utilisé avant le sprint final ; il reste
accepté en lecture et normalisé vers `VERIFIER` (`normalizeRole`). Renommer un
rôle ne doit pas verrouiller la personne qui le porte.

## 2. Authentification (§50)

| Mesure | Mise en œuvre |
|---|---|
| OTP | 6 chiffres, source cryptographique, TTL 10 min, haché SHA-256 + sel |
| Force brute | 5 tentatives par code, 3 codes/heure/destination, limite par IP |
| Temps constant | `timingSafeEqual` sur la comparaison |
| Sessions | JWT HS256, cookie `HttpOnly` + `Secure` + `SameSite=Lax`, TTL 30 j |
| Révocation globale | `sessionVersion` — incrémenté à la suspension et à la suppression |
| Énumération de comptes | Réponse identique que le compte existe ou non |
| MFA | TOTP obligatoire pour tout rôle interne — voir §2.1 |
| Journalisation | Chaque action d'administration dans `AdminAction` + `AuditLog` |

### 2.1 Accès au back-office : trois facteurs, deux sessions

Se connecter à EDENIA **ne suffit pas** à ouvrir le back-office. Un membre du
personnel doit franchir deux portes successives :

1. la session utilisateur ordinaire — OTP par téléphone ou e-mail ;
2. une **élévation** : mot de passe administrateur + code TOTP.

L'élévation pose un second cookie, `edenia_admin`, distinct de la session
utilisateur : domaine de signature différent (`SESSION_SECRET:admin`),
`SameSite=Strict`, durée de 8 heures non prolongeable en silence. Un téléphone
déverrouillé et laissé sur une table ne donne donc pas accès aux dossiers de
vérification.

Le jeton porte une **empreinte** des attributs sensibles du compte (rôle,
activation, date du mot de passe, date d'activation du MFA). Changer l'un
d'eux invalide instantanément toutes les sessions ouvertes — c'est ce qui rend
la révocation immédiate, sans liste noire à maintenir.

| Élément | Mise en œuvre |
|---|---|
| Mot de passe | scrypt (N=16384, r=8, p=1, 64 o), sel de 16 o, paramètres stockés avec l'empreinte |
| Exigence | 12 caractères minimum, refus des mots courants et du nom du compte |
| TOTP | RFC 6238, SHA-1, 6 chiffres, 30 s, tolérance ±30 s, comparaison à temps constant |
| Secret TOTP | Chiffré au repos (AES-256-GCM), jamais renvoyé après l'enrôlement |
| QR code | SVG généré côté serveur — l'URI `otpauth` ne sort jamais vers un tiers |
| Codes de secours | 10 codes à usage unique, hachés, affichés une seule fois |
| Verrouillage | 5 échecs → 15 minutes. Message identique pour mot de passe et code faux |

### 2.2 Premier administrateur, et récupération

Il n'existe **aucun compte par défaut, aucun mot de passe universel, aucun
endpoint de contournement**. Le premier `SUPER_ADMIN` se crée par une commande
locale, qui ne fabrique pas de mot de passe : elle crée le compte sans aucun
identifiant et imprime un lien à usage unique, valable 72 heures.

```bash
npm run admin:create -- --email=vous@exemple.com --name="Votre nom"
```

La personne se connecte à EDENIA avec cette adresse, ouvre le lien, choisit son
mot de passe, scanne le QR code et note ses dix codes de récupération. Le mot de
passe n'existe qu'à partir de ce moment, et personne d'autre ne le voit — pas
même l'administrateur principal.

**Créer un collègue** ne demande jamais d'accès à la base : `/admin/administrateurs`
produit le même type de lien, pour un compte membre existant.

**Procédure de récupération** — trois cas, dans l'ordre de préférence :

1. *Téléphone perdu, codes de secours en main* : saisir un code de récupération
   à la place du code à 6 chiffres. Il est consommé ; il en reste neuf.
2. *Téléphone et codes perdus, un autre administrateur principal existe* :
   `/admin/administrateurs` → « Réinitialiser ». Le mot de passe et le MFA sont
   effacés, un nouveau lien est émis, l'opération est tracée.
3. *Dernier administrateur principal, tout perdu* : accès au serveur requis.

   ```bash
   npm run admin:reset -- --email=vous@exemple.com
   ```

   Cette commande n'affiche aucun mot de passe : elle efface les identifiants et
   imprime un nouveau lien de configuration. Elle écrit `ADMIN_CREDENTIALS_RESET_CLI`
   dans le journal d'audit.

Un `SUPER_ADMIN` ne peut ni se désactiver lui-même, ni désactiver le dernier
administrateur principal actif : se retrouver sans personne pour rouvrir la
porte rendrait la plateforme ingérable.

## 3. Confidentialité (§47)

### 3.1 Une seule frontière

Tout ce qui part vers un navigateur passe par `toPublicProfile()`. La liste
`PRIVATE_KEYS` énumère ce qui ne doit jamais franchir cette frontière, et
`findPrivateLeaks()` parcourt récursivement toute réponse.

En développement, une réponse API contenant un champ interdit **échoue en 500
avec la liste des fuites** plutôt que de partir en silence. Un test de
non-régression couvre les cas imbriqués et les tableaux.

### 3.2 Données sensibles

Les convictions religieuses relèvent d'une catégorie particulière (RGPD art. 9 ;
loi togolaise n°2019-014). Cinq garde-fous, détaillés en C6 :

1. consentement explicite, distinct, révocable (`Consent.FAITH_PROFILE`) ;
2. minimisation dans la vérification église (question fermée unique) ;
3. chiffrement au repos des pièces d'identité (AES-256-GCM) ;
4. visibilité réglable par section, sans perdre la matchabilité — le calcul se
   fait côté serveur, sans exposer les réponses ;
5. purge réelle à la suppression.

### 3.3 Ce qui n'est jamais public

Numéro, e-mail, date de naissance exacte (seul l'âge dérivé), position précise
(ville au maximum), horodatage d'activité (arrondi), trust score, signalements,
notes internes, références de documents.

## 4. Rétention (M3)

| Donnée | Durée |
|---|---|
| Pièces d'identité | ≤ 7 j après décision |
| Compte supprimé | Effacement sous 30 j |
| Compte inactif | 24 mois → notification → anonymisation |
| Audio d'onboarding | Détruit après transcription |
| `AuditLog` | Conservé, `actorRef` pseudonymisé |

## 5. En-têtes et durcissement

### 5.1 Content-Security-Policy à nonce

`script-src` ne contient plus `'unsafe-inline'`. `src/middleware.ts` génère un
nonce par réponse ; Next l'applique à ses scripts d'amorçage, et notre unique
script inline (enregistrement du service worker) le reçoit explicitement. Un
script injecté — faille XSS, extension, intermédiaire réseau — n'a aucun moyen
de deviner le nonce : le navigateur refuse de l'exécuter.

```
script-src 'self' 'nonce-<aléatoire>' 'strict-dynamic'
```

Deux choix assumés :

- `style-src-attr 'unsafe-inline'` reste. Les attributs `style` de React ne
  peuvent pas porter de nonce — c'est une limite du standard, pas un oubli. Le
  risque d'un style injecté est sans commune mesure avec celui d'un script.
- **Le rendu devient dynamique** (`export const dynamic` dans le layout racine).
  Une page prérendue au build ne peut pas porter le nonce d'une requête qui
  n'existe pas encore : ses `<script>` arriveraient sans nonce face à un en-tête
  qui en exige un. Le choix était entre des pages statiques sans protection
  réelle et des pages rendues à la demande avec une vraie CSP. Le surcoût est un
  rendu serveur de quelques millisecondes ; il n'ajoute pas un octet sur le
  réseau, et c'est le réseau qui est le goulot d'étranglement en 3G (§45).

### 5.2 Autres en-têtes

`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` (paiement désactivé, micro/caméra limités à l'origine),
`X-Robots-Tag: noindex` sur `/app/**`, `poweredByHeader` désactivé.

Validation Zod à chaque frontière réseau ; aucune donnée non validée n'atteint
la couche métier.

## 6. Points ouverts, à traiter avant une ouverture au public

La bêta fermée (50 à 100 personnes au Togo) peut se tenir sans ces éléments.
Une ouverture au grand public, non.

- **Limitation de débit en base** : suffisante pour le pilote, à déplacer vers
  un store partagé quand le trafic augmentera.
- **Rotation de la clé de chiffrement** : non implémentée (le format
  `iv.tag.ciphertext` permettra d'ajouter un préfixe de version).
- **Audit externe** : indispensable avant d'exposer un flux de pièces
  d'identité au public.
- **Modération automatique des images** : le contrôle actuel ne juge que des
  critères objectifs (dimensions, format, densité). Ni nudité, ni violence, ni
  présence d'un visage — cela demande un service de vision qui n'est pas
  branché, et nous ne prétendons pas le contraire.
- **Passerelle SMS réelle** et **clés GeniusPay live** : voir docs/12.

### Résolus pendant le sprint final

- ~~`'unsafe-inline'` dans la CSP~~ → nonces, §5.1.
- ~~MFA administrateur~~ → TOTP complet, §2.1.
- ~~Purge automatique~~ → `npm run purge`, à programmer une fois par jour.

## 7. Purge des données (§47)

`src/lib/privacy/purge.ts`, exécutée par `npm run purge` (`--dry-run` pour un
inventaire sans suppression). À programmer quotidiennement. Idempotente : la
relancer deux fois de suite ne fait rien de plus la seconde fois.

| Étape | Règle |
|---|---|
| Pièces d'identité | Références chiffrées effacées à l'échéance `purgeAfter` (≤ 7 j) |
| Comptes supprimés | Effacement définitif 30 j après la demande, **fichiers compris** |
| Comptes inactifs | Dépublication après 24 mois. Aucune donnée effacée à ce stade |
| Défis OTP | 2 jours |
| Compteurs de débit | Fenêtres expirées, 24 h de grâce |
| Événements webhook | 90 jours. Les paiements eux-mêmes sont conservés (comptabilité) |
| Conversations IA terminées | 180 jours. Le profil qui en est issu reste |
| Invitations administrateur | Supprimées à expiration |

Le `AuditLog` survit à tout, parce que ses identifiants sont pseudonymisés : il
ne contient rien qui permette de retrouver quelqu'un.
