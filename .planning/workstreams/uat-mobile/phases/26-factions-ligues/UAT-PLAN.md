# Phase 26 : Plan d'UAT émulateur (Factions & Ligues)

En file (après P1). Préalable : migrations **`20261201260100` -> `20261201260500`** appliquées par l'orchestrateur, après approbation, sur la branche jetable `uat-v1-20` UNIQUEMENT (jamais portfolio). Avant l'UAT, rejouer le harnais SQL local : `P26_PG_URL=postgres://postgres@127.0.0.1:<port>/p26 node scripts/uat/p26-league-sql/run.mjs` (114 PASS attendus). Backend UAT : `bash scripts/uat/backend-start.sh` (faux Upstash 8210, faux Anthropic 8211, backend 8200 ; émulateur : `EXPO_PUBLIC_API_URL=http://10.0.2.2:8200`). Détail : `UAT-BACKEND.md`. **Aucun appel Anthropic réel** (faux local).

Comptes : `uat-athlete` (A, `a0a0a0a0-...a1`, tier à régler par étape), `uat-athlete-b` (B, `b0b0b0b0-...b1`), coach `c0c0c0c0-...c1` (lié à A). Captures d'écran + `uiautomator dump` + SQL lecture seule. L'UAT n'écrit en base (service_role, branche jetable) que pour armer les seeds indiqués.

## Pilotage du FAUX Anthropic (porte IA de la transition)
La décision passe par `generateObject` : l'outil structuré s'appelle `json`. Armer avant l'étape :
`curl -X POST http://127.0.0.1:8211/__script -d '{"tool":"json","input":{"transition":true,"reason":"Ta régularité des dernières semaines est solide."},"count":1}'` (`transition:false` pour QA-8).
Vérifier : `GET http://127.0.0.1:8211/__script` (journal : modèle, `decision: tool:json`).

## Seeds SQL utiles (branche jetable, service_role)
```sql
-- A en piste Habitudes, tier 3, 4 semaines pleines et consecutives (3 habitudes actives, 21 couples/semaine)
UPDATE ziko_athlete_state SET tier = 3, readiness = 'building', onboarding_profile = '{"experience_level":"beginner"}' WHERE user_id = :A;
DELETE FROM ziko_league_state WHERE user_id = :A; DELETE FROM ziko_league_weeks WHERE user_id = :A;  -- repartir propre
-- puis appeler une fois l'ecran Ligue (cree l'etat) ; ensuite, pour chacune des 4 dernieres semaines (lundi = date_trunc('week', ...)),
-- inserer 21 lignes ziko_habit_logs (3 habitudes x 7 jours) et UPDATE ziko_league_state SET last_week_closed = <lundi d'il y a 5 semaines>.
```

| Id | Seed | Étapes | Mesure (réussite) |
|---|---|---|---|
| LG-1 | A tier 2 | Communauté > Fil | carte `Ligue` : sous-titre `Se débloque au niveau 3`, aucun chiffre/rang ; ouvrir : carte `Ligue verrouillée` + `Elle s'ouvre au niveau 3. Continue à ton rythme.` ; AUCUNE barre ni compteur ; base : aucune ligne `ziko_league_state` |
| LG-2 | A tier 3, sans faction, `goal = strength` | ouvrir Ligue | 6 tuiles (>= 72 dp), `Powerlifting` porte `Suggérée` (une seule) ; `Hyrox` jamais suggérée ; tap `Running` -> alerte `Rejoindre Running ?` (2 boutons) ; `Rejoindre` -> carte faction (icône + `Running` + `Changer`) ; base : 1 ligne `ziko_faction_members` |
| LG-3 | LG-2 fait | tap `Changer` | alerte `Tu pourras changer le jj/mm.` (30 j) ; aucune erreur muette ; base : `changed_at` inchangé |
| LG-4 | LG-2 ; ancienner `changed_at` de 31 j (SQL) | `Changer` -> tuile `Hyrox` -> `Rejoindre` | faction = Hyrox ; compteur de faction ABSENT (< 10 adultes) ; vérifier via `uiautomator` qu'aucun texte `membres` n'apparaît |
| LG-5 | A tier 3 débutant, état neuf | ouvrir Ligue | `Piste Habitudes`, palier `Bronze` + 5 points (1 rempli), `Cette semaine : X sur 21 habitudes` (X = couples cochés), aide `ne descend jamais de plus d'un cran`, AUCUN autre nom de personne ; pas de piste Performance visible |
| LG-6 | A avancé (`experience_level = advanced`), état neuf | ouvrir Ligue | `Piste Performance`, unité `séances`, `Cette semaine : X sur 3 séances` (cible par défaut) |
| LG-7 | A habitudes ; 2 semaines pleines closes | rouvrir Ligue | palier `Argent` (2 points remplis) ; pastilles : 2 coches vertes ; base : `division = 2`, 2 lignes `ziko_league_weeks` outcome `hold`/`up` ; `ziko_user_gamification` (xp, coins, streak) et `ziko_athlete_state` (tier) inchangés |
| LG-8 | A palier 3 (pic 3) ; 3 semaines vides closes | rouvrir Ligue | [PLAN MIS A JOUR run 11 : LEAG-04 / migration 2803 : une semaine SANS aucune activite est NEUTRE, donc 3 semaines vides ne font pas descendre ; seules des semaines a score < 30 avec activite hors piste (ex. seances) comptent] palier inchange (`Or`) si au moins une semaine neutre, `Argent` si 3 semaines basses consecutives (3 -> 2 seulement), libellé sans mot `chute/descente/perdu/échec` ; toutes les pastilles `ellipse` grises (jamais rouges) ; encore 3 semaines vides : reste `Argent` (plancher pic-1) ; `ziko_user_gamification` identique avant/après (preuve non punitif) |
| LG-9 | A palier 1 ; 6 semaines vides | rouvrir Ligue | reste `Bronze` (jamais sous le départ) |
| LG-10 | A habitudes, 4 semaines pleines consécutives, faux armé `transition:true` | ouvrir Ligue | modale `Nouvelle piste : Performance` + citation de la raison + UN seul bouton `Continuer` (pas de `Refuser`) ; journal du faux : 1 appel `json` ; `ziko_league_transitions` : 1 ligne `decided_by='ai'`, `celebrated_at` NULL ; `ziko_ai_cost_log` : 1 ligne `source='league_transition'` ; AUCUN débit de crédits (`/credits/balance` inchangé) ; piste = Performance, palier Bronze |
| LG-11 | LG-10 | tap `Continuer` ; fermer/rouvrir l'écran | modale fermée ; ne revient pas (`celebrated_at` posé) ; ligne `Historique Habitudes : 4 semaines` (muted) |
| LG-12 | LG-10 non acquittée, sortir de l'app sans `Continuer` | rouvrir | la modale se réaffiche ; carte d'entrée du Fil : puce `Nouveau` |
| LG-13 | A habitudes éligible, faux armé `transition:false` | ouvrir Ligue | aucune transition ; journal du faux : 1 appel ; `ziko_ai_cost_log` : 1 ligne ; rouvrir plusieurs fois le même jour : 0 appel supplémentaire (`daily_cap`), journal inchangé |
| LG-14 | A habitudes avec 3 semaines seulement, faux armé | ouvrir Ligue plusieurs fois | journal du faux VIDE (0 appel : `not_enough_weeks`), aucune ligne `ziko_ai_cost_log` |
| LG-15 | faux Anthropic arrêté (port 8211 coupé) avec A éligible | ouvrir Ligue | l'écran s'affiche normalement, reste en piste Habitudes, pas de modale ; `ziko_ai_cost_log` : 1 ligne `league_transition` (tentative journalisée, 0 token) |
| LG-16 | A éligible, journal du faux | lire le prompt (log backend) | le prompt ne contient que scores hebdo, moyenne, tier, readiness, expérience ; AUCUN poids/taille/âge/sommeil/email |
| LG-17 | coach crée un défi via l'API : `POST /league/collective` (jeton coach) `{"title":"Défi eau du groupe","metric":"hydration_ml","target_total":10000,"start_date":<aujourd'hui>,"end_date":<+6 j>}` | A ouvre Ligue | section `Défis de groupe` : carte `Défi eau du groupe`, `Groupe : 0 / 10000 ml`, `Rejoindre` (plein) + `Pas cette fois` ; aucune liste de personnes |
| LG-18 | LG-17 ; A tape `Rejoindre` ; A logue 500 ml d'eau (Hydratation) ; B (non lié au coach) | A rouvre Ligue / B ouvre Ligue | A : `Groupe : 500 / 10000 ml`, `Ma contribution : 500`, `1 participant`, lien `Quitter ce défi` ; B : `Aucun défi de groupe pour l'instant` |
| LG-19 | LG-18 ; logs d'eau de la veille (SQL) et 9000 ml le même jour | rouvrir | total plafonné à 4000/jour/personne ; l'eau de la veille n'est pas comptée (pas de rattrapage) |
| LG-20 | LG-18 ; A tape `Quitter ce défi` | rouvrir | total retombe à 0 ; le défi reste proposé (`invited`/`declined` selon la RPC : vérifier que le défi quitté ne revient pas dans la liste) |
| LG-21 | coach hors-ligne de l'app : API | `POST /league/collective` avec jeton d'un athlète non coach ; `metric:"weight_kg"` ; 4e défi actif | 403 `not_a_coach` ; 400 `invalid_arguments` ; 409 `too_many_active_challenges` |
| LG-22 | isolation | jeton de A : `PATCH`/`POST` direct sur `ziko_league_state`, `ziko_league_weeks`, `ziko_faction_members`, `ziko_collective_participants` ; `rpc ziko_league_ai_claim` ; `rpc ziko_league_sync` avec l'`id` de B | permission denied / `forbidden` pour chacun |
| LG-23 | mineur : profil A `age = 15` ; faction avec >= 10 adultes | ouvrir Ligue | écran identique ; compteur de faction jamais affiché ; aucun autre écran ne liste des personnes |
| LG-24 | mode avion après chargement | tirer pour rafraîchir | bandeau `Hors ligne` ; actions (`Rejoindre`) -> bandeau `Action non enregistrée`, jamais silencieux |
| LG-25 | a11y / mesures | `uiautomator dump` | zones tactiles >= 44 dp ; texte >= 12 sp ; contraste boutons pleins (`getActionPrimary` + blanc) ; `paddingBottom: 100` (le dernier bloc n'est pas masqué par la barre d'onglets) |

## Appel réel ultérieur (orchestrateur, UN seul, optionnel)
Sur la branche jetable, backend UAT avec `ANTHROPIC_API_KEY` réelle (jamais prod) : 1 décision de transition sur A éligible. Mesurer : JSON valide, raison en français <= 300 caractères sans mot de santé, `transition` plausible (régularité >= 70 sur 4 semaines), 1 ligne `ziko_ai_cost_log` `league_transition`, coût tokens. Compte rendu dans `26-SUMMARY.md`.

## Vérification base (lecture seule en UAT)
```sql
SELECT track, division, start_division, peak_division, up_streak, low_streak, last_week_closed FROM ziko_league_state WHERE user_id = :uid;
SELECT week_start, track, asked, done, score, division_before, division_after, outcome FROM ziko_league_weeks WHERE user_id = :uid ORDER BY week_start;
SELECT from_track, to_track, decided_by, reason, evidence, celebrated_at FROM ziko_league_transitions WHERE user_id = :uid;
SELECT auto_day, auto_count FROM ziko_league_ai_state WHERE user_id = :uid;
SELECT model, input_tokens, output_tokens, source FROM ziko_ai_cost_log WHERE user_id = :uid AND source = 'league_transition';
SELECT xp, coins, current_streak, longest_streak FROM ziko_user_gamification WHERE user_id = :uid;  -- identique avant/apres toute descente de palier
```
