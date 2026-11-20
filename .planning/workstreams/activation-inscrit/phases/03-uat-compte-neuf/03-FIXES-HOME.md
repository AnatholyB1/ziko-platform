# 03-FIXES-HOME : corrections accueil (UAT v1.21 phase 3)

## Bug 1 (SEV 2) : rangees de la carte "premier entrainement" empilees en colonne
- Cause (supposee, non reproduite sans emulateur) : `PathRow` donnait a `Pressable` un style FONCTION (`({pressed}) => ({...})`), ignore au rendu Android (probablement via l'interop NativeWind qui enveloppe les composants) : plus de `flexDirection: 'row'` ni de padding.
- Fix : style objet simple ; l'etat presse passe par `onPressIn/onPressOut` + `useState`. Libelles a11y ("Conseille" inclus), garde double tap et props inchanges. PathRow est partage avec `CreateProgramSheet` (meme correction).
- Test : `firstWorkoutCard.test.tsx` verifie `data-style-type === 'object'` pour les 3 rangees (le stub react-native expose le type du style).
- Commit : 65acafa2.

## Bug 2 (SEV 4) : "Mission du jour" inchangee apres 2 L d'eau
- Cause : la cle `['onboarding-mission', userId]` (staleTime 60 s) n'etait PAS dans `HOME_QUERY_KEYS` (`lib/homeQueries.ts`). L'invalidation au focus de l'accueil et apres une seance ne la rafraichissait donc jamais ; la requete (qui retourne bien null si `ziko_hydration_logs` a une ligne du jour) gardait sa valeur en cache. Filtre date/fuseau verifie : `localDateKey()` des deux cotes, `date` DATE, coherent.
- Fix : ajout de `['onboarding-mission']` a `HOME_QUERY_KEYS`.
- Test : `homeQueries.test.ts` (vrai QueryClient) : sans invalidation la mission reste perimee, apres `invalidateHomeQueries` elle passe a null.
- Commit : 9f2b4505.
- Composition accueil : `index.tsx` non modifie (carte, Mission du jour, Quetes, Forme du jour inchanges).

## Non prouve (pas d'emulateur)
- Rendu Android reel des rangees (hypothese "style fonction ignore" non confirmee ; si le defaut persiste, chercher l'interop NativeWind / un parent sans largeur).
- Disparition effective de la mission apres retour d'Hydratation (le declencheur est le focus de l'onglet Accueil, comme pour l'eau).
