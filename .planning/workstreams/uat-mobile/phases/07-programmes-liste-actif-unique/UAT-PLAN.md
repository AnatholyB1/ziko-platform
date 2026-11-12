# Phase 7 - Plan d'UAT (Maestro / adb) - Programmes : liste, actif unique, menu

Cible : émulateur `ziko-uat-1`, base = branche jetable (jamais la prod) AVEC les migrations `202612010701..0704` appliquées par l'orchestrateur. File : `queue.sh acquire 07 <flow>`. Preuves : `uat-evidence/07/<flow>/` (PNG 390x844, `uiautomator dump`, logcat, RESULT.txt). Contrat : `04-maquettes-reference/lot-A/DESIGN-CONTRACT.md` (la maquette gagne). Bouton plein = token `getActionPrimary(theme)` = `#CF4509` (blanc dessus 4,66:1).

## Données de départ (branche jetable uniquement)
Athlète UAT `athlete-p7` lié à un coach `coach-p7` :
- P-COACH : `ziko_workout_programs` (`assigned_to_user_id = athlete`, `created_by_coach_id = coach`, `user_id` NULL, `name = 'Force 5x5, bloc 2'`, `days_per_week 3`, `weeks_count 8`, `current_cycle_week 3`, `is_active = true`).
- P-IA : `ziko_ai_generated_programs` (`name = 'Hypertrophie Push Pull Legs'`, `split_type ppl`, `days_per_week 6`, `program_data` sans `generated`, `is_active = false`).
- P-CREE : `ziko_workout_programs` (`user_id = athlete`, `name = 'Mon full body'`, `is_active = false`) avec 1 séance + 2 exercices dans `ziko_program_workouts/_exercises`.
- P-LONG : `ziko_ai_generated_programs` dont le nom fait exactement 60 caractères : `Programme de preparation a la competition de force nationale` (vérifier la longueur = 60).
Pré-contrôle SQL (ordre d'application) : après 0701+0702, `select count(*) from (select coalesce(assigned_to_user_id,user_id) u from ziko_workout_programs where is_active and not is_template group by 1 having count(*)>1) x` = 0 ; idem pour `ziko_ai_generated_programs`.

## Flow A - TRAIN-06 liste complète (critère A-1)
1. Onglet Séance > en-tête, bouton "Mes programmes" (accessibilityLabel) ou "•••" > écran `Programmes`.
2. `uiautomator dump` : 4 rangées programme (P-COACH, P-IA, P-CREE, P-LONG) ; filtres "Tous 4", "IA 2", "Coach 1", "Créés 1".
3. Critère mesurable : nombre d'éléments dont le texte est exactement `ACTIF` = 1 (hero P-COACH, bordure primaire 2 dp, "Semaine 3 sur 8", "38 %"). Bandeau règle présent : "Un seul programme est actif à la fois. En activer un autre met l'actuel en pause."
4. Filtre "Coach" : seul P-COACH ; filtre "IA" : P-IA et P-LONG ; cibles tactiles des filtres >= 44 dp (bounds dans le dump).
5. États : (a) compte sans programme -> texte "Aucun programme pour l'instant" + 2 boutons ("Assistant en 4 étapes", "Ouvrir l'atelier IA"), aucun programme factice ; (b) avion activé avant ouverture -> "Impossible de charger tes programmes" + "Réessayer", 0 rangée ; couper l'avion + "Réessayer" -> la liste apparaît ; (c) pendant le chargement : squelettes `#ECEAE4` (capture rapide, réseau throttlé).

## Flow B - TRAIN-07 un seul actif (critère A-2)
1. P-COACH actif. Rangée P-IA > "Options du programme Hypertrophie Push Pull Legs" > "Définir comme programme actif".
2. Critère A-2 (cas coach) : la feuille A08 s'affiche AVANT toute activation, avec le texte "Remplacer le programme de ton coach ?", "passe en pause. Ta progression est conservée.", "devient ton seul programme actif.", "Ton coach garde la main sur ses programmes" et 2 boutons "Activer Hypertrophie Push Pull Legs" / "Garder le programme du coach". Base : `ziko_workout_programs.is_active` de P-COACH toujours `true` à cet instant.
3. "Garder le programme du coach" -> rien ne change. Recommencer, "Activer ..." -> capture UNIQUE montrant P-IA avec `ACTIF` et P-COACH sans ; toast "Programme actif : Hypertrophie Push Pull Legs". Base : exactement 1 ligne `is_active` sur les 2 tables ; `current_cycle_week` de P-COACH inchangé (3) = progression conservée.
4. Cas sans conflit : P-IA actif, activer P-CREE -> pas de feuille A08, `ACTIF` passe à P-CREE dans la même capture.
5. Test de non-régression "2 actifs" : depuis l'onglet IA du plugin `ai-programs` > "Réactiver" sur un autre programme : même résultat (1 seul actif en base) ; si P-COACH est actif, le message de remplacement du coach est affiché.
6. Test base (psql branche jetable, rôle authenticated) : `select ziko_set_active_program('ai', '<id d un autre athlete>')` -> erreur `program not found` ; sans session -> `not authenticated` ; `update ziko_ai_generated_programs set is_active=true` sur un 2e programme déjà actif du même athlète -> violation de l'index unique.
7. Outil IA : appeler (mock Anthropic, pas d'appel réel) `ai_programs_generate` avec P-COACH actif -> la ligne est insérée `is_active = false` (trigger 0704) ; sans actif coach -> la nouvelle ligne est active et les autres IA inactives.

## Flow C - TRAIN-08 menu (critères A-3, A-4)
1. Rangée P-COACH (actif) > menu : arbre d'accessibilité : 0 élément "Définir comme programme actif" / "Activer" ; entrées "Dupliquer" uniquement (pas de Renommer/Supprimer pour un programme coach, décision D-08) ; mention "Programme actif · ton coach".
2. Menu d'un actif non coach (activer P-CREE d'abord) : "Dupliquer", "Renommer", "Supprimer" + "Supprimer un programme actif le met d'abord en pause."
3. Menu d'un inactif (P-IA) : la 1re entrée est "Définir comme programme actif", hauteur de son bounds >= 48 dp ; puis "Dupliquer" ; puis "Supprimer" séparé par un filet, en `#B5301F`.
4. A-4 : ouvrir le menu de P-LONG : le titre fait <= 2 lignes (bounds de hauteur <= 2 x lineHeight), se termine par une ellipse, jamais réduit à 1 mot. Capture.
5. Actions : Dupliquer P-IA -> nouvelle rangée "Hypertrophie Push Pull Legs (copie)" inactive, `program_data` identique en base ; Dupliquer P-COACH -> copie perso inactive "(copie)" avec ses séances/exercices, sans `created_by_coach_id` ; Renommer l'actif -> le nom change en liste et en base, saisie vide refusée ("Donne un nom à ton programme.") ; Supprimer -> `showAlert` "Supprimer 'xxx' ? Cette action est définitive." ; Annuler = rien ; Supprimer = rangée disparue, ligne absente en base ; supprimer l'actif -> 0 `ACTIF`, aucun autre programme activé automatiquement, le texte "Aucun programme actif. Choisis-en un dans la liste." apparaît.
6. L'ancien `showAlert` à handlers vides (Activer / Dupliquer / Supprimer de l'écran Séance) n'existe plus : "•••" de l'écran Séance ouvre la liste.

## Flow D - TRAIN-09 fin de l'assistant (critère A-5)
1. Écran Programmes > "Nouveau" > "Assistant en 4 étapes" : objectif Force, 8 semaines, jours L/M/V, 2 exercices (Squat, Développé couché) > "Creer mon programme".
2. Base : 1 ligne `ziko_ai_generated_programs` avec `name = 'Force · 3 séances/sem'`, `split_type = 'custom'`, `days_per_week = 3`, `is_active = false`, `program_data.weeks` de longueur 8, 3 séances avec `day_of_week` 1,3,5 (avant : l'insert était rejeté par les colonnes NOT NULL).
3. Écran "Ton programme est prêt" : titre, "3 séances par semaine, 8 semaines.", 3 rangées de séances ("Séance 1 · lundi · 2 exercices"...), "Programme actuel : <nom actif>. L'activer le mettra en pause." (+ " (coach)" si coach), boutons "Définir comme programme actif" et "Plus tard".
4. Critère A-5 : sur 390x844, "Définir comme programme actif" et "Plus tard" sont visibles sans scroll (bounds dans l'écran) ; un tap sur une séance ouvre le détail du programme (1 tap).
5. "Définir comme programme actif" avec P-COACH actif : l'ancien programme passe en pause (1 seul actif en base), alerte "Programme actif : Force · 3 séances/sem" puis retour à la liste où le nouveau porte `ACTIF`. "Plus tard" : retour à la liste, le programme créé est présent, inactif.
6. Retour Accueil/Séance : si le nouveau programme IA est actif, "Allez, c'est parti !" (P6) démarre sa séance du jour planifiée (lun/mer/ven) avec ses 2 exercices.

## Charte (à vérifier sur chaque capture)
Fond `#F7F6F3`, cartes rayon 16 + bord 1 px ; boutons pleins `#CF4509` texte blanc 16 sp gras ; aucun emoji (`uiautomator dump` sans U+1F300-1FAFF) ; racine défilante avec `paddingBottom: 100` (dernier élément non masqué par la tab bar) ; icônes seules avec accessibilityLabel (retour "Retour", menu "Options du programme X").

## Squelette Maestro
```yaml
appId: com.ziko.app
---
- launchApp
- tapOn: "Séance"
- tapOn: "Mes programmes"
- assertVisible: "Programmes"
- assertVisible: "Un seul programme est actif à la fois. En activer un autre met l'actuel en pause."
- assertVisible: "ACTIF"   # puis extractText/uiautomator : compter = 1
- tapOn: "Options du programme Hypertrophie Push Pull Legs"
- assertVisible: "Définir comme programme actif"
- tapOn: "Définir comme programme actif"
- assertVisible: "Remplacer le programme de ton coach ?"
- tapOn: "Activer Hypertrophie Push Pull Legs"
- assertVisible: "Programme actif : Hypertrophie Push Pull Legs"
```
