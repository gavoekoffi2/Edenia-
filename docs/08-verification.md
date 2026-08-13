# 08 — Système de vérification et de confiance

Références : `src/lib/verification/**`, `src/lib/trust/**`.

## 1. Le principe non négociable (§25)

> « Il ne faut jamais promettre une garantie absolue sur la personne. »

Chaque niveau dit **ce qui a été contrôlé**, et affiche à côté **ce que cela ne
prouve pas**. Cette seconde phrase est obligatoire dans le modèle
(`LevelDescriptor.limitation`) et vérifiée par test.

## 2. Les cinq niveaux (§26)

| Niveau | Contrôle | Humain |
|---|---|---|
| 📱 Téléphone | Le numéro appartient au compte | non |
| ✉️ E-mail | L'adresse a été confirmée | non |
| 🪪 Identité | Document + selfie contrôlés et concordants | oui |
| 🛡️ Profil | Plusieurs informations vérifiées une à une | oui |
| ⛪ Église | Une église partenaire confirme connaître la personne | oui |

Le badge « Profil vérifié EDENIA » (§30) n'apparaît qu'après au moins une
vérification **humaine**. Deux canaux de contact vérifiés ne suffisent pas.

## 3. Ce que Premium ne peut pas acheter (C2)

| | Gratuit | Premium |
|---|---|---|
| Voir un badge sur un profil | ✅ | ✅ |
| Demander sa propre vérification | ✅ | ✅ |
| Délai de traitement | identique | identique |
| Filtrer « uniquement vérifiés » | ❌ | ✅ |

Le jour où le badge se vendrait, il ne vaudrait plus rien. La règle est encodée
dans `NEVER_PAYWALLED` et vérifiée par test.

## 4. Procédure humaine (§27)

Chaque type de dossier a une liste de contrôle explicite. **Une approbation
exige que tous les points soient cochés** ; un refus exige un motif d'au moins
10 caractères, transmis à la personne. Les deux règles sont appliquées côté
serveur (`validateDecision`), pas seulement dans l'interface.

La liste identité inclut « la personne a 18 ans révolus », avec mention
« contrôle obligatoire, sans exception ». Un écart détecté entraîne une
suspension immédiate, pas un avertissement.

Les pièces sont détruites au plus tard **7 jours** après la décision, quelle
qu'elle soit. Les conserver serait un risque sans contrepartie.

## 5. Vérification église (§28, §29, C6, C7)

Le flux est unidirectionnel et déclenché par l'utilisateur. EDENIA transmet une
**question fermée unique** :

> « Reconnaissez-vous [prénom] comme une personne que votre église connaît ?
> Réponse attendue : OUI / NON / NE SAIT PAS. Merci de ne transmettre aucune
> autre information : nous n'en avons pas besoin et nous ne les conserverions
> pas. »

Le texte est généré par `churchQuestion()` et affiché tel quel à l'agent :
aucune autre formulation n'est autorisée.

Garanties :
- l'église n'a aucun accès en lecture (profil, matchs, messages) ;
- elle ne voit jamais la liste de ses membres inscrits sur EDENIA ;
- le consentement est explicite, décoché par défaut, et révocable — sa
  révocation fait tomber le badge ;
- seule la réponse fermée et le rôle du répondant sont stockés, jamais son
  identité nominative.

## 6. Trust Score interne (§34, C3)

Deux objets qui ne se croisent jamais dans l'API publique :

| | Badge | Trust Score |
|---|---|---|
| Nature | Factuel, binaire par niveau | Probabiliste, continu |
| Visibilité | Public | **Back-office uniquement** |
| Sens | « Ceci a été contrôlé » | « Ce compte présente un risque » |

Le score est recalculé depuis un **journal** de signaux, avec décroissance
exponentielle (demi-vie ~83 jours) : un incident vieux de six mois ne pèse plus
autant qu'un incident d'hier, sinon un compte ne pourrait jamais se racheter.

Effets, jamais affichés tels quels :

| Bande | Effet |
|---|---|
| `TRUSTED` (≥ 70) | — |
| `NEUTRAL` (40-69) | — |
| `AT_RISK` (20-39) | Visibilité réduite |
| `CRITICAL` (< 20) | Retrait de la découverte, revue avant chat |

`trustScore` figure dans `PRIVATE_KEYS` : un test échoue si une réponse API le
contient.

## 7. Détection d'arnaque (§34)

Motifs observés en Afrique de l'Ouest : demande d'argent (T-Money, Flooz,
Orange Money, Wave, Western Union, cartes de recharge), frais de visa ou de
douane, urgence médicale, sortie précoce vers WhatsApp, déclaration d'amour en
quelques jours.

Sur détection d'une demande d'argent :

1. le destinataire reçoit un avertissement immédiat ;
2. un signalement est créé **d'office** — on n'attend pas que la personne ose ;
3. un signal interne alimente le score ;
4. le message est marqué pour revue humaine.

L'expéditeur n'est **jamais** informé de la détection : le prévenir lui
apprendrait à la contourner.

## 8. Rôle d'agent de vérification (§36)

Volontairement étroit : `verification.read`, `verification.decide`,
`verification.request_info`, `verification.read_documents`, `church.manage`,
`users.read`.

Il n'a **pas** accès aux conversations, aux paiements, au bannissement, ni à la
gestion des administrateurs. Le §36 le demande explicitement, et un test le
vérifie.
