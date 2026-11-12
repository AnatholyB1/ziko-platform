# UAT-PLAN Phase 17 : Sommeil (saisie manuelle et donnees reelles)

Prerequis : migration `supabase/migrations/202612011701_sleep_manual_entry.sql` appliquee sur la base de test (jamais en prod par l'agent). Harnais : P1. Rien n'a ete execute sur emulateur par l'agent de build.

## Seeds (base de test, comptes distincts)
| Compte | Contenu |
|---|---|
| A | aucune ligne `ziko_sleep_logs`, aucune ligne `ziko_wearable_daily_summary`, `ziko_user_plugins(sleep).settings` absent |
| B | 1 nuit manuelle : date = aujourd'hui (jour du reveil), `bedtime 23:15`, `wake_time 07:00`, `duration_hours 7.75`, `quality 4`, `awakenings 1`, `source 'manual'` |
| C | compte B + 1 ligne `ziko_wearable_daily_summary` meme date : `sleep_hours 7.4`, `sleep_bedtime 23:28`, `sleep_wake_time 06:50`, `sleep_deep_min 85`, `sleep_light_min 230`, `sleep_rem_min 95`, `sleep_awake_min 30` |

## Scenarios
| Id | Critere | Pas | Preuve |
|---|---|---|---|
| SL-1 | Etat vide, 0 `8 h`/`8h00`/score | Compte A : Modules > Sommeil, onglets Cette nuit/Historique ; accueil | capture + recherche texte dans l'arbre d'accessibilite : `Aucune nuit enregistree`, `Logger ma nuit`, `Connecter une source` presents ; chaines `8h00`, `8 h 00`, `score`, `profond`, `leger`, `REM` absentes. Accueil : `Aucune nuit enregistree` |
| SL-2 | Saisie -> meme chiffre ecran + accueil | Compte A : Logger ma nuit, 23:15 -> 07:00, qualite 4, reveils 1, Enregistrer | capture Sommeil `7 h 45`, `4 / 5` ; accueil sous-etiquette `7 h 45 · qualite 4 / 5` ; requete base : 1 ligne `source='manual'`, `duration_hours=7.75` |
| SL-2b | Re-saisie meme date = edition | Re-ouvrir Logger ma nuit meme date : champs pre-remplis, message `Une nuit est deja saisie...`, changer, Enregistrer | base : toujours 1 ligne pour `(user,date)` |
| SL-3 | Sans source : 0 phase hors bandeau | Compte B : Cette nuit | recherche texte : `Profond`, `Leger`, `REM` absents ; bandeau `Les phases ne s'affichent qu'avec une montre...` present |
| SL-4 | Source connectee prime | Compte C : Cette nuit | badge `SANTE CONNECTEE`, `7 h 24`, liste chiffree Profond 1 h 25 / Leger 3 h 50 / REM 1 h 35 / Eveille 30 min, bandeau `La source prime : ta saisie manuelle de cette nuit (7 h 45) est conservee mais n'est plus affichee.` ; accueil = `7 h 24` ; base : ligne manuelle intacte |
| SL-4b | Forcer la saisie | Compte C : Reglages > Source = Saisie manuelle | Sommeil et accueil passent a `7 h 45` |
| SL-5 | Reglages persistes apres relance | Reglages : cible +1 appui (8 h) puis +30 min ; rappel on + heure ; reveil intelligent on ; source ; cocher 2 elements de routine ; tuer l'app, relancer | memes valeurs ; `ziko_user_plugins.settings` (plugin_id sleep) contient `sleep_goal_hours, bedtime_reminder, smart_wake, source, pre_sleep_routine` |
| SL-5b | Rappel = notification locale | Rappel 22:30 puis 21:45 | `adb shell dumpsys notification`/liste planifiee : 1 seule alarme `sleep-bedtime-reminder`, heure +-1 min ; interrupteur off : 0 |
| SL-6 | > 16 h refuse | Logger : coucher 19:00 (stepper), lever 12:30 | message exact `Cette nuit dure 17 h 30. Verifie le coucher et le lever (maximum 16 h).`, `Enregistrer la nuit` desactive, champs conserves ; 0 ligne creee |
| SL-7 | Qualite obligatoire | Logger sans choisir de qualite | bouton desactive |
| SL-8 | Graphe 7 nuits : jour sans nuit = barre absente | Compte avec nuits J, J-1, J-3 | 3 barres, 4 emplacements vides, label d'accessibilite `Moyenne X h YY, cible 8 h` (si cible) |
| SL-9 | Cible accueil = reglage | Cible 7 h 30 : jauge accueil = duree / 7 h 30 ; sans cible : jauge a 0 | comparaison |
| SL-10 | Onglets : marge 16 dp | Capture SubTabs | meme mesure que ST-6 (composant partage P5) |
| SL-11 | Outil IA `sleep_log` | (backend) appel avec `awakenings`, date locale, 17 h | ligne `source='manual'`, `awakenings`; 17 h refuse |

Non automatisable sur emulateur : lecture Health Connect reelle (stades) ; le seed C remplace la source.
