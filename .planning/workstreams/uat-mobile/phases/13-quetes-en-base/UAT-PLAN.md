# Phase 13 : Plan d'UAT émulateur (Quêtes en base)

Les UAT émulateur sont en file (après P1). Préalable : les migrations `202612011201` (P12, source de pièces `achievement`), `202612011301` puis `202612011302` appliquées par l'orchestrateur après approbation. Sans elles, l'onglet Quêtes affiche la carte d'erreur `Quêtes indisponibles` (la RPC `ziko_sync_quests` n'existe pas).

Capture = captures d'écran émulateur + arbre d'accessibilité (`uiautomator dump`). Seeds = lignes dans les tables source (`ziko_hydration_logs`, séances réelles), jamais dans `ziko_user_quests` (progression calculée, pas saisie).

| Id | Seed | Étapes | Mesure (réussite) |
|---|---|---|---|
| Q-1 | compte neuf (aucune ligne `ziko_user_quests`) | Récompenses > Quêtes | sections `Aujourd'hui · se renouvelle dans N h` (2 quêtes : `Terminer une séance` 25, `Boire 2 litres d'eau` 15) et `Cette semaine` (`S'entraîner 3 fois` 60) ; barres à 0 ; pas d'emoji ; base : 3 lignes `ziko_user_quests` `source='starter'`, `status='active'` |
| Q-2 | 2e compte neuf | idem | MÊMES 3 quêtes (titres, cibles, pièces) que Q-1 (QUEST-02) ; base : `SELECT slug,title,target,reward_coins ... ` identique entre les deux comptes |
| Q-3 | compte Q-1 ; ajouter 1300 ml aujourd'hui (via l'écran Hydratation, ou ligne `ziko_hydration_logs` `date` = jour Paris) | revenir sur Quêtes (changer d'onglet puis revenir, ou rouvrir l'écran) | ligne eau = barre ~65 % + `1,3 / 2 L` ; quête encore active ; solde inchangé |
| Q-4 | compte Q-3 ; ajouter 700 ml | revenir sur Quêtes | ligne eau `Terminé · +15 pièces récupérées` (coche verte) ; toast `Quête terminée : Boire 2 litres d'eau (+15 pièces)` ; puce solde +15 ; base : 1 ligne `ziko_coin_transactions` source `quest` ; rouvrir : AUCUN second crédit |
| Q-5 | compte Q-1 | terminer une séance valide (>= 1 série) ; retourner à Récompenses > Quêtes | `Terminer une séance` terminée (+25) ; `S'entraîner 3 fois` = `1 / 3` ; une séance sans série ne change rien |
| Q-6 | compte Q-5 ; terminer 2 séances de plus | Quêtes | hebdo `Terminé · +60 pièces récupérées` ; total pièces cohérent avec l'historique (`Tout voir` > lignes `Quête : ...`) |
| Q-7 | compte Q-1 ; modifier l'heure du téléphone au lendemain 00:05 (Paris) OU attendre minuit | rouvrir Quêtes | nouvelles quêtes du jour à 0 ; ancienne quête non terminée : statut `expired` en base, remplacée donc non affichée ; AUCUNE variation XP/pièces/série (comparer `ziko_user_gamification` avant/après) |
| Q-8 | quête expirée sans remplaçante (ligne `source='ai'` créée par service_role avec échéance passée) | Quêtes | section `Non terminées`, libellé `Non terminée · aucune pénalité`, pas de mot « échec / perdu », hors du compte des actives |
| Q-9 | mode avion | ouvrir Quêtes | carte `Quêtes indisponibles` + `Réessayer`, 0 quête affichée, aucune ancienne quête fictive (`Battre un PR cette semaine`...) ; `Réessayer` reconnecté recharge |
| Q-10 | RLS : 2 comptes A et B | A lit via l'app ; tentative d'écriture client (`PATCH ziko_user_quests`, `DELETE`) avec le jeton de A | écriture refusée (403 / permission denied) ; A ne voit que ses lignes |
| Q-11 | A11Y TalkBack | parcourir Quêtes | chaque ligne annoncée `<titre>. <valeur>. Récompense N pièces` / `Terminé · ...` ; barres = `progressbar` ; cibles >= 44 dp ; bouton `Réessayer` `#CF4509` / blanc |
| Q-12 | stockage P14 (service_role, hors app) | `SELECT ziko_create_quests(:uid, '[{"title":"Test","metric":"habit_logs","target":1}]')` puis logguer une habitude et rouvrir Quêtes | la quête IA apparaît (`source='ai'`, sans modèle), progresse sur données réelles, est créditée ; un client authentifié ne peut PAS appeler la fonction |

## Vérification base (lecture seule en UAT)
```sql
SELECT slug, scope, status, progress, target, reward_coins, period_start, expires_at, rewarded_at
FROM ziko_user_quests WHERE user_id = :uid ORDER BY scope, created_at;
SELECT amount, source, description, created_at FROM ziko_coin_transactions
WHERE user_id = :uid AND source = 'quest' ORDER BY created_at DESC;
SELECT COUNT(*) FROM ziko_user_quests WHERE user_id = :uid AND status = 'completed' AND rewarded_at IS NULL; -- doit etre 0
```

## Seeds / besoins humains
Approbation + application de 1301 puis 1302 (après 1201) ; fuseau Europe/Paris et pièces 25/15/60 à confirmer ([A CONFIRMER] G-1, G-2) ; Q-7 demande de changer l'heure de l'émulateur.
