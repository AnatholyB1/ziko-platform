# FIX-UAT-RUN7 (branche `fix/uat-run7`, base `milestone/v1.20`)

## Corrige (un commit par defaut, avec test)
1. **P6 Entrainement vs Programmes** : l'ecran Seance avait sa propre requete (`['active-program']`) qui AVALAIT toute erreur de
   lecture (`catch { return null }`) : un echec juste apres reconnexion devenait un "aucun programme" mis en cache. Il utilise
   maintenant `useActiveAIProgram` (meme `getActiveProgram`, meme cle que l'accueil, `retry: 2`, `refetchOnMount: 'always'`),
   avec etat d'erreur + "Reessayer" (jamais "Aucun programme actif" sur erreur). `activeProgramView` (pur, teste) distingue
   loading / error / empty / no-sessions / ready. Programme sans seance : "Ce programme n'a pas encore de seances" (ecran Seance
   et constructeur `workout/[id].tsx`). `ProgramRelaunchBanner` invalide la cle partagee.
2. **P11 HY-2** : Pressable a style statique `{flex:1,height:132}` + carte (fond, bord, ombre, etat presse) dans un View interne
   (`plugins/hydration/src/tileStyles.ts`). Test : dimensions/fond/bord/etat presse + garde "plus de style fonction".
3. **P22** : `classifyLoadError` (401/403 = Session expiree + "Se reconnecter" via `onReauth`, pas de retry sur 401 ; reseau =
   "Verifie ta connexion" ; reponse HTTP recue = serveur). Mon coach (`CoachScreen`) et historique Journal (erreur de lecture
   n'est plus "Aucune entree").
4. **P10 stock bas** : seuil STRICT (`quantite < seuil`) dans `computeMissing` : un article tout juste range (qte 1 = seuil 1)
   n'est plus "Stock bas". Tests (insert du ranger -> non manquant ; sous le seuil -> "Stock bas").
5. **Mineurs** : `endSentence` (plus de "13 nov.."), `formatFr` du SDK (`formatLitersFr`, `formatKgFr`, `formatKcalFr`, `frCount`)
   applique a la jauge accueil, hydratation, TDEE, RPE/1RM ; pluriels "1 serie" (resume, detail seance, description exercice),
   "1 jour" (Comparer) ; `quickLog.formatLitres` en "0,25 L". Double comptage : `startSession` mono-vol (deux appels concurrents
   inseraient deux seances ouvertes, cf. `closeStaleOpenSessions`), test.
7. **routeTargets** : le scanner couvre `{ pathname }` (Link href / router.push, y compris ternaires), auto-test ajoute.

## Non corrige / decision
- **Niveau Communaute "niveau 1" vs gamification 3** : le deverrouillage lit `ziko_athlete_state.tier` (D-02 verrouille, FIX-UAT-RUN5
  6d : autre notion que `ziko_user_gamification.level`). Au demarrage a froid hors ligne la lecture echoue -> repli niveau 1
  (`levelFallback`). Aligner le gating sur le niveau XP change la regle produit : decision necessaire (ou rephraser le message
  en "palier"). Rien modifie.
- **Double comptage "2 sur 4" vs "+2"** : cause exacte non prouvee sans donnees ; compteurs distincts (accueil = 7 jours glissants,
  Entrainement = fenetre du programme `sessions_done`). Seule course trouvee et corrigee : `startSession` concurrent.
- **6 GRANT service_role `ziko_shopping_list_items`** : aucune lecture/ecriture dans `backend/api/src` (table lue par le mobile en
  `authenticated`, GRANT present dans la migration portfolio). Pas de migration ajoutee ; test statique GRANT inchange et vert.
- Duplication assumee : `frCount`/format litres existent aussi cote app (`frLabels`, `quickLog`) car l'index du SDK n'est pas
  importable en test node et l'import relatif sort du projet TS mobile.

## A re-verifier sur emulateur
Entrainement apres reconnexion (donnees effacees) ; tuiles hydratation (132 dp, fond, 3 de large egale) ; Mon coach apres logout
global (bandeau Session expiree) ; Ranger "Pates" (plus de retour en Stock bas) ; "+N" accueil apres UNE seance.

## Gate
tsc mobile + backend vert ; `npx vitest run` racine 1168 ; backend 569 (3 skipped) ; rendu mobile 89 ; GRANT statique vert.
`plugins/coach` tsc : erreurs TS6307 preexistantes (authStore hors projet), non liees.
