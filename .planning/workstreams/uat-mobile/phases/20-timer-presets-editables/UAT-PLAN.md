# Phase 20 : plan UAT emulateur (TIMR-01..03)

Prerequis humain/orchestrateur : appliquer `supabase/migrations/202612012001_timer_preset_fields.sql` sur la base cible AVANT le premier test d'ecriture (sinon insert/update echouent : colonnes `warmup_sec`, `sets`, `round_rest_sec` absentes). Compte de test remis a zero (P1) pour TI-2.

| Id | Scenario | Attendu | Mesure |
|---|---|---|---|
| TI-1 | Sur chaque onglet (Séance, Tabata, Intervalle) : Nouveau preset > nom + valeurs > Enregistrer ; ligne visible avec resume chiffre et duree ; menu `...` > Modifier (changer une valeur, enregistrer) ; Dupliquer (`<nom> (copie)`) ; Supprimer > message `Supprimer ce preset ? Cette action est définitive.` > Annuler (rien ne change) puis Supprimer (ligne disparue, reste apres relance) | CRUD complet x3 onglets, confirmation avant suppression | captures + `select` lecture seule sur `ziko_timer_presets` |
| TI-2 | Compte neuf (0 preset) : ouvrir Timer, parcourir les 3 onglets | 0 ligne partout, etat vide (`Aucun preset d'intervalle`, `Aucun preset de séance`, `Aucun preset Tabata`) + bouton `Nouveau preset` ; aucune ligne `Exemple`, `Force`, `Hypertrophie`, `Endurance`, `Cardio HIIT` | capture par onglet |
| TI-3 | Onglet Intervalle > Nouveau preset : saisir C22 (nom `Côtes 400 m`, echauffement 5 min, effort 1 min 30, repos 1 min, series 6, rounds 3, repos entre rounds 2 min) | 6 champs modifiables (steppers 44 dp, appui long = repetition acceleree, tap sur la valeur = saisie numerique), `Durée totale : 54 min (échauffement compris).` | capture, ecart 0 min vs formule |
| TI-4 | Onglet Séance > Nouveau preset | l'editeur n'expose que Repos + Séries (pas d'echauffement/effort/rounds) | capture |
| TI-5 | Choisir un preset (tap ligne) > Demarrer | le decompte suit echauffement > effort > repos > ... > repos entre rounds ; libelle de phase + `Round x/y · Série a/b` ; pause/reprise ; mise en arriere-plan 30 s puis retour : temps correct | observation + capture |
| TI-6 | Ancien deep link `timer/manager` (IA `timer_manager`) | redirige vers le Timer | observation |
| TI-7 | Preset ancien (type `emom`/`hyrox`/`functional`) en base | visible sous l'onglet Intervalle, modifiable, `exercises` conserve | lecture seule base apres edition |

Notes : donnees de test creees par le compte UAT uniquement ; aucune ecriture sur la prod hors compte UAT. Q-P20a : les lignes `Exemple` historiques ne sont PAS supprimees par migration (reset du compte de test).
