# 12 — Intégration GeniusPay

Agrégateur de paiement d'EDENIA : Mobile Money (Wave, Orange, MTN, Moov,
Airtel, M-Pesa…) et cartes bancaires, via une page de checkout hébergée.

Base : `https://geniuspay.ci/api/v1/merchant`

## 1. Le principe qui gouverne tout

> **Le retour de l'utilisateur sur `success_url` ne confirme rien.**

N'importe qui peut ouvrir `/paiement/succes?ref=...`. La seule source de vérité
est le backend : soit un webhook signé, soit une consultation directe de
`GET /payments/{reference}`. Premium n'est activé que sur un `COMPLETED`
confirmé de cette façon — jamais sur une redirection.

## 2. Configuration

| Variable | Rôle |
|---|---|
| `PAYMENT_PROVIDER` | `simulated` (défaut) ou `geniuspay` |
| `GENIUSPAY_BASE_URL` | `https://geniuspay.ci/api/v1/merchant` |
| `GENIUSPAY_ENVIRONMENT` | `sandbox` ou `live` |
| `GENIUSPAY_API_KEY` | `pk_sandbox_…` / `pk_live_…` |
| `GENIUSPAY_API_SECRET` | `sk_sandbox_…` / `sk_live_…` |
| `GENIUSPAY_WEBHOOK_SECRET` | `whsec_…`, rendu **une seule fois** à la création du webhook |

Aucune de ces variables n'est préfixée `NEXT_PUBLIC_` : elles ne peuvent donc
pas atteindre le navigateur. Elles ne sont lues que dans
`src/lib/payments/geniuspay/client.ts` et dans la route webhook.

### Garde-fous au démarrage

En production, l'application **refuse de démarrer** si :

- les clés API ou le secret webhook manquent ;
- `GENIUSPAY_ENVIRONMENT=sandbox` (les paiements seraient simulés en ligne) ;
- les clés commencent par `pk_sandbox_` / `sk_sandbox_` ;
- le secret webhook est encore celui du repli de développement.

Un échec bruyant vaut mieux qu'une boutique qui encaisse en sandbox.

## 3. Parcours de paiement (§8)

```
Utilisateur clique « Continuer vers le paiement »
        │
        ▼
POST /api/v1/payments            EDENIA crée Payment + Subscription (PENDING)
        │
        ▼
POST geniuspay /payments         sans payment_method → page de checkout
        │                        metadata : user_id, order_id, subscription_id,
        │                                   plan, environment
        ▼
   checkout_url                  redirection du navigateur
        │
        ▼
Page GeniusPay                   le client choisit Wave / Orange / MTN / carte
        │
        ├──────────────► webhook signé  ──► /api/v1/webhooks/geniuspay
        │                                        │
        ▼                                        ▼
retour success_url               vérification signature + horodatage
        │                        idempotence, machine d'état
        ▼                                        │
/paiement/succes ─── interroge ──► /api/v1/payments/status ◄── activation Premium
```

`payment_method` est **volontairement omis** : c'est ce qui déclenche la page de
checkout hébergée. Le client y choisit son moyen, et GeniusPay route lui-même
vers le bon opérateur à partir du numéro international (§16). EDENIA ne
réimplémente pas cette logique et ne collecte **aucune** donnée de carte (§17).

## 4. Sécurité du webhook (§11)

Contrat GeniusPay :

```
signature = HMAC-SHA256(timestamp + "." + json_payload, whsec_secret)   [hex]
```

Contrôles appliqués, dans cet ordre :

1. secret configuré, sinon rejet ;
2. en-têtes `X-Webhook-Signature` et `X-Webhook-Timestamp` présents ;
3. **anti-rejeu** : écart ≤ 5 minutes, dans les deux sens ;
4. signature valide, comparée à **temps constant** ;
5. `X-Webhook-Environment` cohérent avec le serveur.

Le corps est lu en **texte brut**, jamais via `request.json()` : la signature
porte sur les octets reçus, et un aller-retour de parsing les modifierait.

### Une subtilité qui aurait causé des rejets aléatoires

La documentation signe `json_encode($request->all())`, c'est-à-dire une
*re-sérialisation* du corps. Or PHP et JavaScript n'encodent pas le JSON de la
même façon : PHP échappe les slashes (`\/`) et l'unicode (`\uXXXX`). Un webhook
contenant une URL ou un prénom accentué aurait produit une signature différente
côté EDENIA.

`verifyWebhook` accepte donc trois formes, toutes comparées à temps constant :
le corps brut, une re-sérialisation JavaScript, et une imitation de
`json_encode()` de PHP. Aucune n'affaiblit la vérification — chacune exige la
connaissance du secret. Un test couvre explicitement la variante PHP.

## 5. Idempotence (§12)

Table `WebhookEvent`, contrainte d'unicité sur `(gateway, deliveryId)`.

L'idempotence repose sur la **contrainte en base**, pas sur un `SELECT`
préalable : deux livraisons simultanées du même événement ne peuvent donc pas
passer toutes les deux. La seconde échoue à l'insertion et est ignorée.

`deliveryId` vient de `X-Webhook-Delivery`, documenté comme optionnel. À défaut,
on retombe sur `payload.id`, puis sur une empreinte HMAC du corps — il faut
toujours une clé.

## 6. Machine d'état (§13)

```
PENDING ──► PROCESSING ──► COMPLETED ──► REFUNDED
   │            │              
   ├────────────┴──► FAILED / CANCELLED / EXPIRED   (définitifs)
```

Une transition non autorisée est refusée **avec un motif enregistré**. Le cas
réel qui justifie cette machine : GeniusPay livre `payment.success`, puis un
`payment.initiated` retardé arrive. Sans elle, un paiement encaissé
régresserait en « en attente ». Le motif le dit explicitement, pour que le
support ne cherche pas un bug inexistant.

## 7. Modèle de données (§14)

| Table | Rôle |
|---|---|
| `Plan` | Offres, prix, durée |
| `Subscription` | Abonnement daté : `PENDING → ACTIVE → EXPIRED / CANCELLED` |
| `Payment` | Une commande : `orderRef` (EDENIA), `providerRef` (GeniusPay), montant, devise, statut, environnement |
| `PaymentTransaction` | **Chaque** transition, avec l'événement qui l'a provoquée |
| `WebhookEvent` | Journal d'idempotence |

Premium n'est **jamais** un booléen : `premiumStatus()` le dérive d'un
abonnement actif et non expiré. L'historique financier reste reconstituable, ce
qui est indispensable en cas de litige.

Un renouvellement **prolonge** l'abonnement en cours au lieu de l'écraser :
payer deux fois ne fait pas perdre les jours déjà achetés.

## 8. Montants

GeniusPay attend le montant en unités de la devise, minimum 200 XOF.

XOF et XAF n'ont pas de subdivision : notre `priceCents` vaut directement des
francs (2000 = 2 000 FCFA). Pour EUR/USD, `toGatewayAmount()` divise par 100.
Se tromper ici coûterait un facteur 100 dans un sens ou dans l'autre — d'où le
test dédié.

## 9. Tester sans compte GeniusPay

Avec `PAYMENT_PROVIDER=simulated`, un checkout local remplace la page GeniusPay.

Il ne prend **aucun raccourci** : il fabrique un payload authentique, le signe
avec le secret configuré, puis le fait passer par exactement le même code que la
production — vérification de signature, contrôle d'horodatage, idempotence,
machine d'état. Un raccourci qui activerait Premium directement laisserait le
vrai chemin non testé, c'est-à-dire précisément celui qu'on ne peut pas se
permettre de découvrir en ligne.

L'écran est étiqueté « 🟡 CHECKOUT SIMULÉ » et n'existe pas quand un agrégateur
réel est configuré.

## 10. Passer en production

1. Créer le webhook côté GeniusPay :
   `POST /webhooks` avec `url = https://<domaine>/api/v1/webhooks/geniuspay` et
   les événements `payment.success`, `payment.failed`, `payment.cancelled`,
   `payment.refunded`, `payment.expired`.
2. Récupérer le `whsec_…` — **il n'est rendu qu'une fois**.
3. Renseigner les variables (`live`, clés `pk_live_`/`sk_live_`).
4. `PAYMENT_PROVIDER=geniuspay`.
5. Vérifier `/admin/services` : la ligne Paiement doit passer en 🟢 PRODUCTION.
6. Faire un paiement réel de 200 FCFA et vérifier le journal dans
   `/admin/paiements`.

## 11. Ce qui reste à faire

- **Remboursement depuis le back-office.** L'événement `payment.refunded` est
  traité et désactive l'abonnement, mais EDENIA ne peut pas *déclencher* un
  remboursement : la documentation consultée n'expose pas d'endpoint de
  remboursement. À faire depuis le tableau de bord GeniusPay en attendant.
- **Renouvellement automatique.** `Plan.isRecurring` existe et vaut `false`
  partout. Aucun abonnement n'est reconduit sans accord explicite.
- **Réconciliation périodique.** Un paiement dont le webhook s'est perdu reste
  `PENDING`. La consultation à la demande couvre le cas au retour de
  l'utilisateur ; une tâche planifiée qui repasse sur les `PENDING` de plus
  d'une heure reste à écrire.
- **Cartes bancaires** : passent par le checkout hébergé, jamais testées en
  conditions réelles faute de compte marchand actif.
