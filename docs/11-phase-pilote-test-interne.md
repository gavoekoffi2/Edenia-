# 11 — Phase de test interne (marché pilote Togo)

Cette phase n'est **pas** un déploiement public. L'objectif est de pouvoir
parcourir tout le produit sans dépendre d'un SMS, d'un e-mail ou d'un paiement
réels — sans pour autant désactiver le moindre contrôle de sécurité.

## 1. Le principe

> Le mode développement ne retire aucun contrôle. Il rend seulement les services
> externes inutiles pour tester.

Appliqué à l'authentification : le code OTP devient **prévisible**, mais il est
toujours généré, haché avec un sel, stocké, comparé à temps constant, soumis au
compteur de tentatives et à l'expiration. Le chemin de vérification est
exactement celui de la production — c'est ce qui garantit qu'on ne teste pas un
parcours différent de celui qui partira en ligne.

C'est la différence entre « simuler le service » et « contourner la sécurité ».
Seule la première est acceptable.

## 2. Démarrer

```bash
npm install
npm run db:reset:dev   # base + référentiels + 11 profils de test togolais
npm run dev            # http://localhost:3000
```

Puis : `/inscription` → un numéro togolais → code **228228** (aussi affiché à
l'écran) → onboarding IA → profil → découverte.

## 3. Configuration

| Variable | Valeur pilote | Effet |
|---|---|---|
| `AUTH_MODE` | `development` | Code OTP fixe `228228`, **aucun SMS envoyé** |
| `SMS_PROVIDER` | `console` | Aucune passerelle appelée |
| `EMAIL_PROVIDER` | `console` | Aucun e-mail envoyé |
| `PAYMENT_PROVIDER` | `simulated` | Aucun débit réel |
| `AI_PROVIDER` | `rulebased` | Extracteur local, sans appel réseau |
| `STORAGE_PROVIDER` | `local` | Photos écrites dans `.uploads/` |

Passer en production : `AUTH_MODE=production` + les vrais fournisseurs. Aucune
autre modification de code n'est nécessaire.

### Le garde-fou qui compte

`AUTH_MODE=development` **en production fait échouer le démarrage** :

```
AUTH_MODE=development est interdit en production : l'OTP serait previsible.
```

Un OTP prévisible en ligne serait une porte ouverte sur tous les comptes. Cette
configuration ne doit pas pouvoir survivre à une erreur de déploiement, d'où un
échec bruyant plutôt qu'un avertissement.

## 4. Ce qui reste identique à la production

| Contrôle | Statut en mode test |
|---|---|
| Hachage salé du code, comparaison à temps constant | actif |
| 5 tentatives par code, expiration à 10 minutes | actif |
| Limitation de débit par destination et par IP | actif, seuil élargi |
| Validation des numéros togolais | **identique à la production** |
| RBAC, permissions, refus par défaut | actif |
| Frontière de sérialisation, détecteur de fuites | actif |
| Anti-arnaque, trust score, modération | actif |
| Chiffrement des champs sensibles | actif |

Un numéro refusé en test sera refusé en ligne : c'est voulu, pour ne pas
découvrir les cas limites au lancement.

## 5. Togo-first, sans rigidité

L'expérience est mono-pays : le sélecteur d'indicatif se replie en `🇹🇬 +228`,
et seules les villes togolaises sont proposées.

Ce n'est pas codé en dur. Trois mécanismes le portent :

- `Country.isLaunched` — `dialCodeOptions()` ne rend que les pays ouverts ;
- `PHONE_RULES` (`src/lib/geo/phone.ts`) — les règles du Bénin, de la Côte
  d'Ivoire, du Cameroun et du Sénégal sont **déjà écrites** ;
- les requêtes de villes filtrent sur `isLaunched`, jamais sur `"TG"`.

**Ouvrir le Bénin** = passer `isLaunched: true` dans `src/lib/geo/data.ts` et
re-seeder. Le sélecteur de pays réapparaît de lui-même, les villes béninoises
deviennent choisissables, la validation des numéros béninois s'applique. Aucun
composant à modifier — un test le vérifie.

## 6. Comptes de test

`npm run db:seed:dev` crée 11 profils togolais, tous joignables avec le code
`228228` :

| Numéro | Prénom | Scénario couvert |
|---|---|---|
| `+22890000101` | Yao | Référence masculine, profil vérifié |
| `+22890000102` | Akosua | Compatibilité très élevée, identité + église vérifiées |
| `+22890000103` | Délali | Compatibilité moyenne, compte **Premium** |
| `+22890000104` | Sylvie | Compatibilité faible |
| `+22890000105` | Ayoko | Profil très incomplet → confiance « LOW » |
| `+22890000106` | Kossi | **Signalé** pour demande d'argent |
| `+22890000107` | Edem | **Restreint** — absent de la découverte |
| `+22890000108` | Mawuli | Bonne compatibilité, autre ville |
| `+22890000109` | Essi | Gratuit, non vérifié — le cas courant |
| `+22890000110` | Afiwa | Compatibilité élevée |
| `+22890000111` | Rachelle | **Non publiée** — jamais visible |

Back-office : `admin@edenia.app` (super admin), `verification@edenia.app`
(agent de vérification, périmètre restreint).

Le script **refuse de s'exécuter** si `NODE_ENV=production` : de faux profils
dans une base réelle fausseraient les statistiques et la découverte, et
contrediraient frontalement la promesse du §65.

## 7. Signalisation du mode

- **Back-office** : bandeau `🟡 DEVELOPMENT MODE`, avec la liste des services
  simulés et le code OTP de test.
- **Écran de saisie du code** : encart `🟡 OTP — MODE TEST`, qui précise
  qu'aucun SMS n'est parti et qu'en production le code n'apparaît jamais.
- **Écran Premium** : encart `🟡 PAIEMENT — MODE TEST`, qui précise qu'aucun
  débit n'a lieu.
- **`/admin/services`** : état de chaque service, et ce qui reste à brancher.

Aucun de ces éléments n'apparaît en production : `showDevIndicator` combine
`!isProd` et la présence effective d'un service simulé.

## 8. Photos

Implémentées pendant cette phase, car aucune découverte n'a de sens sans elles.

Traitement à l'arrivée : validation du type et du poids (8 Mo max), rotation
selon l'orientation EXIF, redimensionnement à 1080 px, réencodage WebP,
génération d'un aperçu de 16 px en data URI. Les métadonnées EXIF sont
supprimées — elles contiennent souvent la position GPS de la prise de vue, ce
que le §24 interdit d'exposer. Une photo de 1400 × 1000 tombe ainsi sous 2 ko.

Modération : en développement, auto-approbation **tracée en base**
(`moderationReason: "Auto-approuvée — mode développement, aucune revue
humaine."`). En production, la photo reste `PENDING` et passe par la file de
modération du back-office. Le contrôle automatique se limite honnêtement aux
dimensions et au format : la détection de nudité demande un service de vision
qui n'est pas branché, et approuver à l'aveugle serait pire que d'attendre.

## 9. Avant la bêta publique

| À brancher | Interface prête | Où |
|---|---|---|
| Passerelle SMS | `SmsProvider` | `src/lib/notifications/index.ts` |
| E-mail transactionnel | `EmailProvider` | idem |
| Agrégateur Mobile Money | `PaymentProvider` | `src/lib/payments/provider.ts` |
| Stockage objet | `StorageProvider` | `src/lib/storage/photos.ts` |
| Modération d'images | `autoModerate` | idem |

Plus, côté sécurité : nonces CSP, flux TOTP administrateur, tâche de purge des
données (`docs/09` §6).

## 10. Vérification effectuée

Les 23 parcours demandés ont été exécutés contre le serveur réel, sur base
neuve. Résultats dans le rapport de la phase pilote — dont : validation des
numéros togolais (4 cas limites refusés avec le bon motif), photo téléversée et
servie en 1594 octets, match calculé à 84 %, détection d'une demande d'argent en
T-Money, RBAC refusant l'accès au back-office à un membre, et bandeau de mode
présent côté back-office mais absent côté membre.
