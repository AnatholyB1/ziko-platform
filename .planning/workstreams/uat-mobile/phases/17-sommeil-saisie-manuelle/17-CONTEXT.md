# Phase 17: Sommeil : saisie manuelle et données réelles - Context

**Gathered:** 2026-11-12 (voie DISCUSS, agent w2a). Req : SLP-01..SLP-06. Vague 2 (apres P8, deja livre). UI hint oui : le **contrat du lot C** (`lot-C/DESIGN-CONTRACT.md`, ecrans C24-C30, criteres SL-1..SL-6, ecart de primaire `#CF4509` §0) tient lieu de UI-SPEC.
**Statut :** pret pour planification ; `[A CONFIRMER]` = reponse recommandee retenue.

<domain>
## Phase Boundary

Le Sommeil ne montre que des donnees vraies et se renseigne a la main : etat vide `Aucune nuit enregistree` + `Logger ma nuit` + `Connecter une source` ; saisie (coucher, lever, duree calculee, qualite 1-5, reveils) ; phases profond/leger/REM **uniquement** si une source connectee les fournit, et cette source prime ; reglages editables et persistes ; l'accueil et l'ecran Sommeil montrent le meme chiffre. Hors perimetre : lecture reelle Health Connect sur emulateur (dev-client requis, non prouvable), score de recuperation affiche, tuile accueil elle-meme (P8) hors le calcul de la nuit.
</domain>

<decisions>
## Implementation Decisions

### Decides (maquette lot C + recap, ne pas redemander)
- **D-01** SLP-02 : jamais de valeur par defaut. Etat vide C24 ; **aucune** chaine `8h00`, `8 h 00`, ni "score" sur un compte sans nuit (SL-1, recherche texte). Plus de phases calculees (`dh * 0.24` factice dans `SleepPlugin.tsx`).
- **D-02** SLP-01 : saisie C25 = nuit (date), coucher et lever (steppers de 15 min), **duree calculee**, qualite 1 a 5 (5 puces 48 dp, 1 = tres mauvaise), reveils ; validation C26 : duree > 16 h = message sous le champ `Cette nuit dure 17 h 30. Verifie le coucher et le lever (maximum 16 h).`, bouton `Enregistrer` desactive, rien d'efface (SL-6 : saisie 19:00 / 12:30).
- **D-03** SLP-03/04 : badge de source (`SAISIE MANUELLE` / `SANTE CONNECTEE`) ; phases (profond/leger/REM/eveille) = barre decorative + **liste chiffree equivalente**, seulement avec une source qui les fournit (SL-3 : 0 mention de profond/leger/REM hors bandeau d'information sans source) ; source connectee prime : la saisie manuelle de la meme nuit est **conservee en base mais masquee**, bandeau `La source prime : ta saisie manuelle de cette nuit (7 h 45) est conservee mais n'est plus affichee.` (lot C critique Q4) ; la duree affichee est celle de la source (SL-4).
- **D-04** SLP-05 : reglages C29 editables et persistes apres relance (SL-5) : cible (stepper), rappel du coucher (interrupteur + heure), reveil intelligent (interrupteur, fenetre 30 min), source (segment Saisie manuelle / Sante), routine pre-sommeil (cases). Interrupteurs `accessibilityRole="switch"`, steppers `adjustable`.
- **D-05** SLP-06 : accueil (C30) = le meme chiffre `7 h 45 · qualite 4 / 5`, ou `Aucune nuit enregistree` + `Logger` ; graphe 7 nuits : jour sans nuit = **barre absente**, pas de zero ; barre d'onglets du module avec marge laterale 16 dp et indicateur inset 12 dp (retour UAT "onglets sans marge").
- **D-06** Charte : Ionicons, styles inline, `showAlert`, `paddingBottom: 100`, primaire d'action = valeur tranchee par la question Q1 (le lot C est rendu en `#CF4509`).

### Zones grises : reponse recommandee retenue `[A CONFIRMER]`
- **D-07 [A CONFIRMER] Modele de donnees : une ligne par nuit, une seule table de saisie.** `ziko_sleep_logs` (`UNIQUE(user_id, date)`, `bedtime`/`wake_time` en `text`, `duration_hours`, `quality NOT NULL CHECK 1..5`, `notes`) n'a ni reveils ni source ni phases. Recommandation : migration 1701 ajoute `awakenings smallint not null default 0 check (awakenings between 0 and 20)` et `source text not null default 'manual' check (source in ('manual','health'))` a `ziko_sleep_logs`, et `sleep_deep_min`, `sleep_light_min`, `sleep_rem_min`, `sleep_awake_min` (smallint nullable) a `ziko_wearable_daily_summary` (qui a deja `sleep_hours`, `sleep_bedtime`, `sleep_wake_time`, `UNIQUE(user_id,date)`). La nuit connectee reste dans `ziko_wearable_daily_summary` ; la saisie reste dans `ziko_sleep_logs` ; **aucune duplication**.
- **D-08 [A CONFIRMER] Resolution de la nuit affichee** : un seul hook `useSleepNight(date)` dans `apps/mobile/src/hooks/` (consomme par l'ecran Sommeil ET `useSleepToday` de l'accueil) : si `reglage source = health` ET une nuit wearable existe pour la date (`sleep_hours` non nul) alors elle gagne ; sinon la saisie manuelle. Reglage par defaut = `health` quand le plugin `wearables` est connecte, sinon `manual` ; l'utilisateur peut forcer `manual`. La **date d'une nuit = le jour du reveil** (comme le code Health Connect existant et `useSleepToday`) ; saisir une nuit pour une date deja renseignee ouvre la ligne en edition (upsert sur `(user_id, date)`, pas de doublon).
- **D-09 [A CONFIRMER] Reglages sans nouvelle table.** Persister cible, rappel, reveil intelligent, source, routine dans `ziko_user_plugins.settings` (jsonb, `plugin_id = 'sleep'`), le mecanisme qu'utilise deja `saveSleepGoal` (store.ts) pour `sleep_goal_hours` ; `HOME_DEFAULTS.sleepTargetH = 8` (accueil) est remplace par la cible reglee, ou **absence de cible** (jauge masquee) tant qu'aucune n'est definie (coherence avec "aucune valeur par defaut").
- **D-10 [A CONFIRMER] Rappel du coucher = notification locale programmee** (`expo-notifications`, declencheur quotidien a l'heure choisie ; mise a jour/annulation au changement), sans push serveur ni cron (les 7 crons existants n'ont pas de granularite par utilisateur). Preuve : liste des notifications planifiees (heure +-1 min), aucun envoi reel. Le champ `sleep_reminder` de `ziko_notification_preferences.type_prefs` n'est pas utilise ici.
- **D-11 [A CONFIRMER] Reveil intelligent (question Q9).** Aucune API d'alarme fiable cote app : recommandation = **preference enregistree et editable**, avec libelle honnete `S'activera avec une source connectee` ; pas de notification de reveil simulee. A ne pas presenter comme fonctionnel dans les captures.
- **D-12 [A CONFIRMER] Phases : source Health Connect.** `plugins/wearables/src/store.ts` lit `SleepSession` mais ne sort ni stades ni qualite (`SleepData` : date, bedtime, wake_time, duration_hours, quality). Recommandation : etendre `SleepData` avec les minutes par stade (mapping des `stages` Health Connect : profond / leger / REM / eveille) et les ecrire dans les colonnes D-07 a la synchro. **Non prouvable sur emulateur** (pas de donnees Health Connect reelles) : preuve = tests unitaires du mapping + ligne de test inseree par le seed UAT (SL-4).
- **D-13 [A CONFIRMER] Score de recuperation** : `getRecoveryScore()` du store reste disponible pour l'IA/les autres ecrans mais n'est **plus affiche** dans le module (SL-1 interdit tout score sans nuit ; le contrat n'en montre aucun).
- **D-14 Outil IA `sleep.ts`** (`backend/api/src/tools/sleep.ts`) : `today()` est en UTC (dette notee en P8) ; le `sleep_log` doit ecrire `source='manual'`, `awakenings` optionnel, et accepter la date locale du client. Pas de nouveau tool, `registry.ts` non touche.
- **D-15 Qualite obligatoire** : `quality` est `NOT NULL` en base -> le bouton `Enregistrer` reste desactive tant qu'aucune qualite n'est choisie (pas de qualite par defaut a 3).
</decisions>

<specifics>
## Specific Ideas
Seed UAT : compte sans nuit (SL-1), compte avec 1 nuit manuelle `7 h 45` / qualite 4 (SL-2), compte avec une ligne `ziko_wearable_daily_summary` + colonnes de phases (SL-3/SL-4), saisie 19:00 -> 12:30 pour SL-6, relance de l'app pour SL-5. Pas d'appel reel Health Connect.
</specifics>

<canonical_refs>
## Canonical References
- `phases/04-maquettes-reference/lot-C/DESIGN-CONTRACT.md` §0 (primaire `#CF4509`), §1 (Sommeil), §2 (C24-C30), §3, §4 (accessibilite : liste chiffree des phases, `accessibilityLabel` du graphe), §5 (SL-1..SL-6), §6 ; `lot-C/04-sommeil.html` ; `lot-C/CRITIQUE.md` Q1, Q4 ; `../shared/DESIGN-SYSTEM.md`
- `REQUIREMENTS.md` SLP-01..06 ; `ROADMAP.md` Phase 17 ; `MILESTONE-RECAP-2026-11-12.md` §9 ; `phases/08-accueil-quick-log/08-SUMMARY.md` (hooks accueil, date locale)
- `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (`ziko_sleep_logs` + contraintes, `ziko_wearable_daily_summary`) ; `20261107170000_ziko_revoke_client_dml.sql` ; `supabase/migrations/README-v1.20.md`
</canonical_refs>

<code_context>
## Existing Code Insights
- `plugins/sleep/src/screens/SleepPlugin.tsx` (465 l.) : `TABS = ['Cette nuit','Historique','Reglages']` ; `SETTINGS` statique ("8h00 / nuit", lignes non cliquables) ; `score {quality * 20}/100`, phases `dh * 0.24` calculees ; moyenne `cible 8h00` en dur.
- `plugins/sleep/src/screens/SleepLog.tsx` (174 l.) : saisie existante a steppers (a refaire selon C25) ; `store.ts` (106 l.) : `logs`, `sleepGoalHours`, `saveSleepGoal` -> `ziko_user_plugins.settings`, `getRecoveryScore`.
- `apps/mobile/src/hooks/useHomeData.ts` : `useSleepToday()` (lit `ziko_sleep_logs` du jour, `duration_hours`, `quality`...) et `HOME_DEFAULTS.sleepTargetH = 8` ; `apps/mobile/app/(app)/index.tsx` l.288-325, 488 (tuile Sommeil `Pas de donnees` / `XhYmin`).
- `plugins/wearables/src/store.ts` (`SleepData`, `getHealthConnectSleep`, sync vers `ziko_wearable_daily_summary`) ; `WearablesPlugin.tsx` l.190.
- `backend/api/src/tools/sleep.ts` (150 l.) ; routes minces `apps/mobile/app/(app)/(plugins)/sleep/{dashboard,log}.tsx`.
### Integration Points
Fichier partage `useHomeData.ts` / `index.tsx` (propriete P8, deja livre) : edits localises sur le hook sommeil et la sous-etiquette de la tuile. `i18n.ts` : namespace `sleep.*` a la fin. `registry.ts` non touche.
### Migrations (bloc `20261201 1701-1709`, fichiers seulement)
- `202612011701_sleep_manual_entry.sql` : colonnes D-07 (`ADD COLUMN IF NOT EXISTS` ; defaut `source='manual'` pour les lignes existantes) ; aucune nouvelle table ; grants inchanges (les colonnes heritent de ceux de la table).
</code_context>

<deferred>
## Deferred Ideas
Reveil intelligent reel (alarme native) ; import d'historique depuis la source connectee ; plusieurs sessions par jour (siestes) ; score de recuperation refondu ; analyse IA du sommeil ; partage de nuit au coach (`ziko_coach_alerts` `sleep_drop` existe cote coach, hors perimetre).
</deferred>

---
*Phase: 17-sommeil-saisie-manuelle*
*Context gathered: 2026-11-12*
