# 09 — Rôles administrateurs, sécurité et confidentialité

## 1. Rôles (§36, §50, §51)

Principe : **refus par défaut**. Une permission absente de la liste d'un rôle
est refusée, sans héritage implicite.

| Rôle | Périmètre |
|---|---|
| `USER` | Aucune permission d'administration |
| `SUPPORT` | Lecture seule : utilisateurs, signalements, dossiers |
| `ANALYST` | Statistiques agrégées uniquement |
| `VERIFICATION_AGENT` | Dossiers de vérification, pièces, églises. **Ni conversations, ni paiements, ni bannissement** |
| `MODERATOR` | Signalements, sanctions jusqu'à la suspension, photos, messages signalés. **Pas les pièces d'identité** |
| `ADMIN` | Tout sauf gestion des administrateurs et remboursements |
| `SUPER_ADMIN` | Tout |

Les deux séparations importantes :
- un **modérateur** ne voit pas les pièces d'identité ;
- un **agent de vérification** ne voit pas les conversations.

Chacun a besoin de données sensibles, mais pas des mêmes. Croiser les deux
accès dans un seul rôle créerait un point de compromission unique.

## 2. Authentification (§50)

| Mesure | Mise en œuvre |
|---|---|
| OTP | 6 chiffres, source cryptographique, TTL 10 min, haché SHA-256 + sel |
| Force brute | 5 tentatives par code, 3 codes/heure/destination, limite par IP |
| Temps constant | `timingSafeEqual` sur la comparaison |
| Sessions | JWT HS256, cookie `HttpOnly` + `Secure` + `SameSite=Lax`, TTL 30 j |
| Révocation globale | `sessionVersion` — incrémenté à la suspension et à la suppression |
| Énumération de comptes | Réponse identique que le compte existe ou non |
| MFA | TOTP obligatoire pour tout rôle interne (`requiresMfa`) |
| Journalisation | Chaque action d'administration dans `AdminAction` + `AuditLog` |

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

CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`),
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` (paiement désactivé, micro/caméra limités à l'origine),
`X-Robots-Tag: noindex` sur `/app/**`, `poweredByHeader` désactivé.

Validation Zod à chaque frontière réseau ; aucune donnée non validée n'atteint
la couche métier.

## 6. Points ouverts, à traiter avant une mise en production réelle

Ces éléments sont hors du périmètre de cette itération et doivent être traités
avant l'ouverture au public :

- **`'unsafe-inline'` dans la CSP** pour les scripts et styles — à remplacer par
  des nonces. Next 16 le permet via middleware.
- **MFA administrateur** : l'interface `requiresMfa` et le champ `mfaSecretEnc`
  existent, le flux TOTP n'est pas implémenté.
- **Limitation de débit en base** : suffisante pour le pilote, à déplacer vers
  un store partagé quand le trafic augmentera.
- **Purge automatique** : les durées de rétention sont définies et les champs
  (`purgeAfter`, `deletionRequestedAt`) existent ; la tâche planifiée qui les
  applique reste à écrire.
- **Rotation de la clé de chiffrement** : non implémentée (le format
  `iv.tag.ciphertext` permettra d'ajouter un préfixe de version).
- **Audit externe** : indispensable avant d'exposer un flux de pièces
  d'identité au public.
