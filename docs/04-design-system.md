# 04 — Design system

Référence : `src/app/globals.css`. Le §44 demande « premium + moderne + africain
+ chaleureux + chrétien, mais sans clichés ».

## 1. Trois partis pris

### 1.1 Aucune police web

Le stack système coûte 0 ko. Une police Google coûte 150 à 250 ko avant le
premier texte lisible. Sur une 3G à 400 kbit/s, c'est 3 à 5 secondes d'écran
vide — la seule optimisation qui change réellement l'expérience sur les marchés
cibles (§7, §45), et personne ne remarque l'absence.

### 1.2 Rien de religieux dans le décor

Pas de croix, pas de colombe, pas de poisson, pas de versets en filigrane. Le
§44 les interdit explicitement, et pour une bonne raison : une interface qui
signale sa piété par son décor paraît soit datée, soit condescendante. La foi
est dans le contenu — les sections « Ma foi », les questions, le matching.

### 1.3 Une palette de matières, pas de saturation

| Rôle | Couleur | Usage |
|---|---|---|
| Fond | `sand-100` `#faf6f1` | Chaleur sans jaunissement |
| Texte | `ink-800` `#241d17` | Brun-noir, jamais du noir pur |
| Accent | `clay-500` `#c0563b` | Terre cuite — action principale |
| Confiance | `verd-500` `#2e4b45` | Vert profond : Eden, la croissance |
| Distinction | `gold-400` `#d99b4e` | **Uniquement** badges et Premium |
| Danger | `danger-500` `#b93a2f` | Avertissements de sécurité |

Le doré n'est jamais décoratif : s'il apparaît, c'est qu'il y a une
vérification ou un abonnement. Un accent qui signifie quelque chose vaut mieux
qu'un accent joli.

Pas de rouge vif, pas de rose, pas de dégradé violet : ce sont les marqueurs
visuels du dating généraliste, et le §64 exclut cette filiation.

## 2. Composants et contraintes intégrées

Certains composants portent une règle produit dans leur signature — c'est le
moyen le plus fiable de la faire respecter.

| Composant | Contrainte |
|---|---|
| `CompatibilityMeter` | `caption` est **obligatoire**. Un score ne peut pas être affiché seul (§21) : le code ne compile pas. |
| `SafetyNotice` | Pas de bouton de fermeture. Un avertissement anti-arnaque escamotable ne sert à rien. |
| `Avatar` | Repli local sur l'initiale — aucune requête réseau pour un placeholder. |
| `ProfileActions` | « Signaler » et « Bloquer » au même niveau visuel que « Liker ». |

## 3. Mobile-first, concrètement (§6)

- Cible tactile minimale : **44 px** (`.e-btn { min-height: 2.75rem }`).
- Taille de police des champs : **16 px** — en dessous, iOS zoome tout seul.
- Navigation principale en **barre basse**, atteignable au pouce.
- `env(safe-area-inset-bottom)` pour les encoches.
- Aucune interaction ne dépend du survol.

## 4. Chargement et mouvement (§45)

- `.e-skeleton` plutôt qu'un indicateur tournant : perçu comme plus rapide, et
  aucune image à télécharger.
- Transitions ≤ 150 ms, uniquement sur `background-color`, `border-color` et
  `opacity` — jamais sur `layout`, coûteux en CPU sur un appareil d'entrée de
  gamme.
- `prefers-reduced-motion` respecté globalement.

## 5. Thème sombre

Trois états gérés : choix explicite clair, choix explicite sombre, et défaut
système. Les tokens sont définis sur `:root` nu, puis redéfinis sous
`@media (prefers-color-scheme: dark)` et sous `[data-theme="dark"]`.

## 6. Accessibilité

- Contraste AA vérifié sur les paires texte/fond.
- Focus visible partout (`outline: 2px solid clay-500`).
- Lien d'évitement vers le contenu.
- Les régions dynamiques (conversation IA, chat) portent `aria-live`.
- Les icônes décoratives sont `aria-hidden`, jamais porteuses de sens seules.

## 7. Ton éditorial

| Faire | Éviter |
|---|---|
| « Ce score est indicatif. » | « Votre compatibilité parfaite ! » |
| « Nous ne garantissons pas les intentions d'une personne. » | Silence sur les limites |
| « Je note "à discuter" plutôt que d'inventer. » | Remplir à la place de l'utilisateur |
| Tutoiement dans l'onboarding IA | Tutoiement dans les pages légales |
| « 3 likes restants aujourd'hui » | « Plus que 3 likes, passez Premium ! » |

Pas de point d'exclamation dans les messages système. Pas de compte à rebours
artificiel. Pas de culpabilisation à la désinscription.
