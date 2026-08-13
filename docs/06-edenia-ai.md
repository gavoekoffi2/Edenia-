# 06 — Architecture EDENIA AI

Références : `src/lib/ai/**`. Tests : `tests/ai.test.ts`.

## 1. Le principe : le moteur pilote, le modèle formule

L'erreur la plus commune serait de confier la conduite de l'inscription à un
modèle de langue. On obtiendrait une conversation agréable et interminable —
exactement ce que le §61 interdit.

Ici, le partage est net :

| Décision | Qui |
|---|---|
| Quel sujet aborder maintenant | `onboarding.ts` (déterministe) |
| Quand s'arrêter | `onboarding.ts` (budget de tours) |
| Comment formuler la question | Fournisseur IA |
| Ce qui est extrait | Fournisseur IA, **puis** garde-fous |
| Ce qui est enregistré | L'utilisateur (§14) |

## 2. Couches

```
              ┌──────────────────────────────┐
Route API ───►│  OnboardingEngine            │  choisit le sujet, compte les tours
              └──────────┬───────────────────┘
                         ▼
              ┌──────────────────────────────┐
              │  AiProvider (interface)      │  §48 : aucun SDK dans le métier
              ├──────────────┬───────────────┤
              │ Anthropic    │  RuleBased    │  repli local, sans réseau
              └──────────────┴───────────────┘
                         ▼
              ┌──────────────────────────────┐
              │  Guardrails                  │  §13 (ancrage) + §40 (interdits)
              └──────────┬───────────────────┘
                         ▼
              ┌──────────────────────────────┐
              │  Persistence + relecture     │  §14 : validation humaine
              └──────────────────────────────┘
```

## 3. §13 — « L'IA ne doit jamais inventer »

Une consigne dans un prompt n'est pas une garantie. La règle est donc appliquée
en aval, sur la sortie, quel que soit le fournisseur :

1. **Contrat fermé.** 26 champs autorisés (`FIELD_SPECS`). Une clé hors liste
   est rejetée sans examen.
2. **Ancrage obligatoire.** Chaque valeur doit porter une `sourceQuote`
   réellement présente dans les propos de l'utilisateur (comparaison sur forme
   normalisée : accents et ponctuation tolérés, reformulation non). Sans
   citation vérifiable, la valeur est rejetée — **même avec une confiance de 1**.
3. **Bornes de type.** Un âge de 12 ans ou une dénomination inventée sont
   rejetés.
4. **Confirmation.** Les champs marqués `requireConfirmation` (prénom, âge,
   dénomination, désir de mariage, enfants, expatriation…) passent
   systématiquement en `NEEDS_CONFIRMATION`.
5. **« Je ne sais pas » est une réponse.** `UNDECIDED` est une valeur de
   première classe, affichée « à discuter », et traitée comme neutre — jamais
   comme un désaccord — par le moteur de matching.

Les extractions rejetées sont conservées en base : c'est la trace qui permet de
vérifier en production que le garde-fou fonctionne, et pas seulement en test.

## 4. §40 — Ce que l'IA n'a pas le droit de dire

Filtre de sortie sur chaque message assistant, y compris les textes de profil
générés. Motifs bloqués : « envoyé(e) par Dieu », « âme sœur », « Dieu t'a
destiné / réservé / préparé », « c'est elle/lui que Dieu… », « tu vas te
marier », « je te garantis que… », « cette personne est honnête ».

Un message bloqué est remplacé par une formule sobre qui rend le discernement à
l'utilisateur, et la violation est journalisée.

## 5. Le fournisseur local n'est pas un bouche-trou

`RuleBasedAiProvider` est une grammaire d'extraction du français tel qu'il
s'écrit et se parle sur les marchés cibles. Il remplit trois rôles :

- **Repli** — coupure réseau, budget IA épuisé, incident fournisseur.
  En Afrique de l'Ouest, une coupure pendant l'inscription ne doit pas faire
  perdre le compte.
- **Développement et test** — le parcours complet tourne sans clé API.
- **Oracle** — il définit en clair ce que « comprendre » signifie pour EDENIA.

Piège rencontré et corrigé : en JavaScript, `\b` ne délimite pas un mot à côté
d'une lettre accentuée. `\blomé\b`, `\bévangélique\b` et `\bâme sœur\b` ne
matchaient jamais. Remplacé par des lookarounds Unicode `(?<!\p{L})…(?!\p{L})`.
Sur un produit francophone, ce détail décide de la moitié des extractions.

## 6. Coût par utilisateur

| Levier | Effet |
|---|---|
| 12 tours maximum | Plafonne un onboarding à ~4 000 tokens |
| Une extraction par tour, pas par champ | Divise les appels par 10 |
| `knownKeys` transmis | Le modèle ne re-extrait pas ce qui est acquis |
| Limitation de débit par utilisateur | Empêche l'abus |
| Repli local | Le service ne tombe jamais pour cause de budget |

Sur un marché à faible ARPU (§43), c'est une contrainte de survie, pas une
optimisation.

## 7. Mode vocal (C8)

Trois niveaux dégradés, dans cet ordre : transcription serveur sur audio Opus
compressé → Web Speech API du navigateur → **saisie clavier, toujours visible**.

La transcription arrive dans le champ de saisie, pas directement dans la
conversation : l'utilisateur relit et corrige avant d'envoyer (§12). L'audio
brut est supprimé après transcription.

## 8. Changer de fournisseur

Implémenter `AiProvider` (trois méthodes), l'enregistrer dans `getProvider()`,
changer `AI_PROVIDER`. Aucun code métier ne bouge, et les garde-fous
s'appliquent identiquement — c'est tout l'intérêt de les avoir placés en aval.
