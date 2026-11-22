# UAT-RESULTS run1 (milestone v1.20, branche `uat/run1` = milestone/v1.20 + seeds)

Cible : AVD `ziko-uat-1`, APK uat-dev (EAS eade2d72), Metro 8281 (env branche `uat-v1-20`, API 10.0.2.2:8200 = AUCUN backend), base Supabase `oloobswzsziidjwycthm`. Preuves locales (gitignore) : `uat-evidence/<phase>/` dans le worktree agent (p2, 03, 05, 06, 06x, 07, 08, 12, 19). Methode : liens profonds `ziko://<route>` + dumps uiautomator + captures ; Maestro uniquement pour le login (`demo-login-nav` PASSE). Le flow `.maestro/p03-habits-crash.yaml` ECHOUE tel quel (`launchApp` ramene au launcher dev-client).
Legende : PASS / FAIL / BLOQUE-BACKEND / NON-TESTE. Aucune correction applicative faite.

## Constats a traiter (FAIL), par priorite
1. **P8 U4 - feuille "Log ton poids" masquee par le clavier** : champ (y=2057) et "Confirmer" (y=2236) sous le clavier (haut clavier y~1695) ; poids non saisissable. Capture `uat-evidence/08/u7-alert.png`. Cause probable : bottom sheet sans KeyboardAvoidingView (composant Quick Log de `apps/mobile/app/(app)/index.tsx`).
2. **P12 R-2 - Succes "0 sur 0"** : `ziko_badge_definitions` RLS active SANS policy SELECT dans les migrations du depot (`pg_policies` vide). A verifier en prod ; si prod a la policy, ajouter une migration. Avec une policy `using(true)` : "5 sur 12 debloques, 42 %".
3. **P5 XCUT-06 - noms d'exercices accueil** en anglais minuscule ("assisted lying calves stretch") alors que l'ecran seance affiche les `name_fr`. Carte "Mission du jour" lit le nom brut du program_data.
4. **P8/P11 - objectif d'eau incoherent** : accueil "0.5L / 2.5L" vs ecran Hydratation "0.8L / 2.0L".
5. **P5 - i18n ecran seance** : "8 exercises", "PROGRAM OVERVIEW", "3 sets . 10 reps", "TARGET", "reps", "Reps done", instructions en anglais ; header Habitudes "Habits".
6. **P2 U1 - refresh au retour NON observe** malgre horloge +2 h/+2 j/+400 j (aucune nouvelle ligne `auth.refresh_tokens`, token stocke valide a +2840 s). Suspect (listener AppState authStore.ts:206 / sessionManager.ts:75) ou artefact du test ; a rejouer en attente reelle > 1 h.
7. Mineurs : emoji dans l'etat vide Habitudes (U+1F331) ; FAB "Signaler un bug" recouvre le titre "QUICK LOG" ; grille Quick Log decalee apres le 1er log (taps rapides ratent la tuile) ; libelle niveau "NIVEAU . DEBUTANT ... Niveau maximum atteint" a 0 XP ; texte coach IA Mesures "mesures stables" sans aucune mesure ; log E `refresh_token_not_found` au demarrage sur session morte.

## Resultats par phase
| Phase | Verdict | Detail (criteres) |
|---|---|---|
| P2 Session | PASS partiel | U4 PASS (A->B "Envoyee", ligne `ziko_friendships` pending). U2 PASS partiel (session morte + token expire -> ecran login, pas de boucle ; alerte "Session expiree" non observee a froid). U1 non concluant (voir 6). U3/hors-ligne NON-TESTE. |
| P3 Habitudes | PASS | Habitudes x3 stable (sans donnees ; puis avec 4 habitudes + rappels), 0 FATAL logcat ; cause racine du blanc d'origine NON reproduite. crash-test : "Ce module a rencontre un probleme", Reessayer, Retour a l'accueil, autre module OK. Etapes avion/session-expiry NON-TESTE. |
| P5 Transverses | PASS partiel | XCUT-01, 02 (Terminer, Pantry), 03 (echantillon), 07 PASS ; XCUT-06 FAIL ; XCUT-04/05 NON-TESTE. |
| P6 Seance | PASS partiel | A PASS (jour de repos -> prochaine seance "Lower", 8 exos, "Exercice 1/8"), C PASS (seance vide : "Fin de l'entrainement" puis alerte "Seance non enregistree", 0 ligne en base). B, D, E, F NON-TESTE. |
| P8 Quick Log | PARTIEL | U14 PASS, U1/U3 PASS (0.75L, persiste), U4 FAIL (clavier), U7 PASS partiel (0 ligne creee, alerte non vue). Reste NON-TESTE (U5-U6, U8-U13, U15-U18). |
| P11 Hydratation | PARTIEL | Ecran, boutons +250/+500/+750 et journal presents ; incoherence objectif ; reglages NON-TESTE. |
| P7 Programmes | PARTIEL | Flow A PASS (filtres 3/1/1/1, 1 "ACTIF", bandeau regle). B, C, D NON-TESTE (SWITCH_COACH dans le seed). |
| P12 Recompenses | PARTIEL | R-1 PASS (solde = `ziko_user_gamification.coins`), R-2 FAIL (policy), boutique/historique PASS partiel ; R-3..R-10, Q6-Q8 NON-TESTE. |
| P9 Repas | NON-TESTE | |
| P10 Garde-manger | PARTIEL | Onglets Inventaire/Recettes/Courses, groupes Frigo/Congelateur/Placard, badges EXPIRE / DANS 2 J PASS. Recettes IA/courses : BLOQUE-BACKEND / NON-TESTE. |
| P19 Complements | PARTIEL | Catalogue 6 produits, prix "des 21,00 EUR" = minimum des 3 sources, stack vide + CTA PASS ; comparateur/favoris NON-TESTE. |
| P15 Mesures | PARTIEL | Ecran s'ouvre (3 onglets) ; saisie/objectifs NON-TESTE. |
| P21 Amis | PARTIEL | Envoi PASS ; ecran Amis ; acceptation par B / profil complet NON-TESTE (compte B pret). |
Comparaison maquettes (lots A-F) : NON FAITE (PNG non regeneres, contexte epuise) ; ecarts mesurables releves seulement quand evidents (ci-dessus).

## Notes environnement / harness
- Le bootstrap n'avait PAS cree `ziko_athlete_state` pour l'athlete A : gating niveau 1 => modules verrouilles (Garde-manger, Sommeil, Nutrition "se debloque au niveau 2"). Corrige dans le seed (tier=5, level=5).
- Horloge emulateur modifiable sans root via `adb shell cmd alarm set-time <ms>` (auto_time 0) ; session modifiable via `run-as com.ziko.mobile` sur `databases/RKStorage` (sqlite, cle `sb-<ref>-auth-token`) + `node:sqlite` ; `adb shell` sous Git Bash exige `MSYS_NO_PATHCONV=1` pour les chemins `/sdcard`.
- Premier bundle Metro a froid ~140 s (erreur "SocketTimeout" du dev-client tant que non fini) ; "System UI isn't responding" une fois (Wait).
- Seed : `scripts/uat/seed-v1-20.sql` (idempotent ; placeholder `__ATHLETE_B_PASSWORD__`). Contient aussi la policy de fixture `badge_definitions_read_uat` (branche uniquement). Habitudes seed (4 habitudes) et resets de logs du jour faits en SQL ad hoc, non commites.
- Contrainte P7 : un seul programme actif par athlete -> seed = programme IA actif ; programme coach inactif (basculer avec SWITCH_COACH pour la feuille A08).
