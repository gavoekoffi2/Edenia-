# 07 — Système de matching

Références : `src/lib/matching/**`. Tests : `tests/matching.test.ts`.

## 1. Ce qui le distingue d'un moteur de dating généraliste

Un moteur classique compare âge, distance et photo. Le §5 du cahier des charges
identifie précisément le problème : deux personnes peuvent être chrétiennes et
profondément incompatibles sur la vision du mariage, les enfants, les finances,
la famille élargie ou le lieu de vie.

Le moteur EDENIA compare **sept dimensions**, dont cinq portent sur des sujets
qu'aucune application généraliste ne collecte.

## 2. Les sept dimensions et leurs poids

| Dimension | Poids | Signaux |
|---|---|---|
| Foi | 0,24 | dénomination, engagement, participation, prière, lecture biblique |
| Vision du mariage | 0,20 | désir, horizon, enfants, nombre, résidence, expatriation |
| Valeurs | 0,15 | traditions, finances, place du travail de chacun, dot, foi dans le couple |
| Projet familial | 0,14 | proximité, soutien à la famille élargie, belle-famille, enfants déjà nés |
| Personnalité | 0,10 | cinq traits, style de gestion des désaccords |
| Mode de vie | 0,07 | centres d'intérêt, tabac, alcool, rythme social |
| Localisation | 0,10 | pays → région → ville |

La foi et le mariage pèsent 44 % à eux deux : c'est la thèse du produit (§65).
Le mode de vie pèse 7 % — c'est un sujet de conversation, pas un facteur de
réussite conjugale.

## 3. Poids adaptatifs

Déclarer un critère essentiel sur un thème signale que ce thème compte :
la dimension correspondante gagne 0,03. Une prière déclarée « centrale »
ajoute 0,04 à la foi ; une recherche strictement locale ajoute 0,04 à la
localisation. Les poids sont ensuite renormalisés à 1 — vérifié par test.

## 4. Trois garde-fous contre le faux précis

1. **Une non-réponse n'est jamais un désaccord.** `UNDECIDED` et
   `PREFER_NOT_SAY` sont neutralisés au niveau des primitives de similarité,
   donc partout à la fois (§13).
2. **La couverture tempère le score.** `score × (0,7 + 0,3 × couverture)` :
   à 40 % de données, le résultat est tiré vers le neutre. Sans cela, trois
   champs remplis produiraient un « 95 % » mensonger.
3. **Plafond à 97 %.** Jamais 100 %. Le score est en outre toujours accompagné
   de sa légende et de la mention « indicatif » (§21).

Un indicateur de confiance (`LOW` / `MEDIUM` / `HIGH`) accompagne le score, et
un message explicite apparaît quand l'un des deux profils est trop peu rempli.

## 5. Préférence ≠ critère essentiel (§22)

| | Préférence | Critère essentiel |
|---|---|---|
| Effet | Pondère le score | **Élimine** du résultat |
| Réciprocité | — | **Bilatérale** |
| Non-réponse | Neutre | Échoue le critère |

La bilatéralité est le point important : proposer à quelqu'un des profils qui
l'excluent d'office est la première cause de frustration dans ce type de
produit. L'interface avertit d'ailleurs dès quatre critères essentiels — chacun
réduit sensiblement le champ des rencontres possibles.

## 6. Localisation sans coordonnées (C4)

Le score se calcule sur la hiérarchie administrative : même ville (1,0) > même
région (0,85) > même pays (0,70, ajusté par la distance entre centroïdes de
villes) > diaspora (0,55 si l'ouverture est déclarée, 0,20 sinon) > autre pays
(0,35).

Aucune position d'utilisateur n'est stockée ni exposée. Les seules coordonnées
manipulées sont les centroïdes des villes — une donnée publique.

## 7. Explication (§21) et vie privée (C5)

L'explication n'utilise que les dimensions que la personne regardée a rendues
visibles. Pour une dimension privée, la formulation devient neutre :
« "Vision du mariage" est un sujet que vous pourriez aborder ensemble. »

Sans cette règle, la phrase donnée en exemple au §21 (« Vous n'avez pas encore
indiqué la même préférence concernant le lieu de résidence ») divulguerait
indirectement la réponse de l'autre personne — en contradiction avec le §60.

## 8. Questions de mise en relation (§33)

Après un match, les questions proposées portent sur les dimensions **les moins
couvertes** : la conversation sert à combler ce que le questionnaire n'a pas su
capter.

## 9. Pureté du moteur

`src/lib/matching/**` ne connaît ni Prisma, ni HTTP, ni React. Le pont vit dans
`from-db.ts`. Trois bénéfices : test exhaustif sans base, exécution possible en
tâche de fond, et extraction future en service indépendant (§48) sans réécriture.

## 10. Limites assumées

- Les traits de personnalité sont déduits de la conversation, avec un intervalle
  de confiance large. Ils pèsent 10 %, délibérément.
- Aucun apprentissage sur le comportement : le moteur ne s'ajuste pas encore aux
  likes observés. C'est une V2 possible, mais elle demande une vigilance
  particulière — un moteur qui apprend des likes apprend surtout les biais de
  physique, exactement ce que le produit veut éviter.
- Pas d'embeddings sémantiques sur les textes libres. Le recouvrement lexical
  utilisé est grossier et n'est qu'un signal faible.
