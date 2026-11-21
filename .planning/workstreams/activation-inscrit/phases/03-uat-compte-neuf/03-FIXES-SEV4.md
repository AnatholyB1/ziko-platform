# Phase 3 - Observations SEV 4 du rejeu UAT (UATN-03)

Branche `fix/uat-sev4` (depuis `milestone/v1.21`). Sources : `03-VERIFICATION.md` (section "Bugs restants" du rejeu), `03-FIXES-REMAINING.md`. Aucun emulateur, aucune migration, aucun deploiement.

| # | Observation | Cause | Correctif | Commit |
|---|-------------|-------|-----------|--------|
| 1 | "Gainage planche 3 x 40 s" affiche "40 rep." dans la seance demarree | `parseSetsSpec` passait le reste "40 s" a `parseReps`, qui lit un nombre sans unite : 40 repetitions. `resolvePlanExercises` ecrivait toujours `duration_* = null` | `parseDuration` (unite obligatoire : s, sec, secondes, min, mn ; "10" nu ou "10 séries" restent des repetitions), `formatDuration`, `describeSetsSpec` ; `parseSetsSpec` renvoie `duration` pour "3 x 40 s", "3 x 30-45 s", "1 min", "45 s" ; `resolvePlanExercises` (seance IA ET seance planifiee, chaines "40 s" d'un programme) remplit `duration_seconds` (fixe) ou `duration_min/max` (plage) : l'ecran de seance existant passe en mode `time` / `timeRange` (affiche "40s", lance le chrono). Apercu IA : "3 séries · 40 s", "4 séries · 12 rép." | 0d61d839 |
| 2 | Toast "Exercices remplaces" tronque | `ToastAndroid` natif : pas de retour a la ligne, coupe apres ~2 lignes | Resume compact : "N exercices remplacés : <1er> par <x> +N-1" (1 seul : texte inchange). Liste complete dans `toastDetail` : annoncee (`AccessibilityInfo.announceForAccessibility`) sur Android, affichee entiere dans l'alerte (qui passe a la ligne) hors Android. `neutralToast(message, detail?)` | 890c92cf |
| 3 | program-builder : "Creer mon programme" / "Continuer" cache par le clavier | Le pied etait hors du ScrollView mais rien ne le remontait au-dessus du clavier | `KeyboardAvoidingView` (`padding` iOS, `height` Android, meme motif que `ai/chat.tsx`) autour du contenu + pied ; ScrollView garde `keyboardShouldPersistTaps="handled"` (suggestions touchables) | 7aa9b1ca |
| 4 | `triggerRetroactiveRecompute` : HTTP 500 | `generateObject` leve `AI_NoObjectGeneratedError` quand le modele ne renvoie pas d'objet structure (faux Anthropic en texte brut ; possible en vrai aussi) ; la route le traitait comme panne serveur | Route `POST /ai/onboarding/retroactive` : cette erreur donne 200 `{ success:false, skipped:'model_no_object' }` (meme famille que `state_exists` / `not_onboarded`). Les autres erreurs restent 500. Reponses de succes inchangees. Client deja non bloquant et silencieux (un `console.warn` au pire, garde anti-doublon) : inchange. `scripts/uat/fake-anthropic.mjs` : sortie structuree (`output_format` / `output_config` json_schema, ou `tool_choice` d'un outil) sans script = objet valide genere depuis le schema (au lieu de `{}` ou de texte) ; le serveur ne demarre que lance directement | 5a1233bc (backend), a47080d5 (faux Anthropic) |
| 5 | Accueil apres seance terminee sans programme : "Aucun programme actif" alors que la carte a disparu | Investigation, **comportement voulu, aucun changement** : R1 masque la carte des qu'une seance est terminee (`finishedCount > 0`), et D-04 / R5 (`hideEmptyMissionVariant`) ne masque la variante vide que TANT QUE la carte s'affiche. Carte absente -> variante vide ("Créer un programme IA") revient, comme avant la phase 2. Aucune contradiction avec `02-CONTEXT.md` D-04 | - |

## Tests ajoutes
- Mobile : `workoutPlan.test.ts` ("3 x 40 s", "3 x 30-45 s", "4 x 12", "3 x 8-10", "1 min", "45 s", unite obligatoire, `formatDuration`, `describeSetsSpec`) ; `workoutStore.test.ts` (seance generee : `duration_seconds` 40, `duration_min/max` 30/45, reps inchangees) ; `generatedStart.test.ts` (resume compact + detail, 1 seul remplacement, remplacements + ignores) ; `workoutNav.test.ts` (structure du builder : ScrollView et bouton principal dans `KeyboardAvoidingView`, `behavior`, `keyboardShouldPersistTaps`, pied hors ScrollView).
- Backend : `backend/api/test/routes/onboarding-retroactive.spec.ts` (succes, skip, `AI_NoObjectGeneratedError` -> 200 `model_no_object`, autre erreur -> 500, sans jeton -> 401).

## Notes produit
- Une prescription en temps dans une seance passe en mode chrono (comportement existant de l'ecran de seance pour `duration_seconds`).
- Le backend change : **redeploiement necessaire** pour que le 500 disparaisse en production (route onboarding).
- "+N" du toast = remplacements supplementaires non nommes ; le detail complet n'est visible a l'ecran qu'hors Android (alerte).

## Non prouve (sans emulateur)
- Rendu reel du clavier : le test ne prouve que la structure (`KeyboardAvoidingView` englobant, `behavior`) ; le comportement `height` Android avec edge-to-edge (SDK 54) et le decalage exact du pied sont a verifier sur appareil.
- Toast Android : longueur reelle affichee et annonce TalkBack du detail non mesurees.
- Seance reelle avec chrono pour "Gainage planche" (appariement catalogue sur la vraie base non rejoue).
- Faux Anthropic : la forme exacte de la requete `generateObject` du SDK (`output_format` vs `tool_choice`) n'a pas ete rejouee contre le faux ; les deux formes sont couvertes par le generateur de schema, verifie unitairement a la main seulement.
