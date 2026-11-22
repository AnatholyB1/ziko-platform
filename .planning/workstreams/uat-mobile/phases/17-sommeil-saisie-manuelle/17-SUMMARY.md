# Phase 17 : Sommeil, saisie manuelle et donnees reelles : SUMMARY

Branche `phase/17-sommeil` (base `milestone/v1.20`, merge de `milestone/v1.20` fait). Slot 1. Aucun push, aucune ecriture prod, migration = fichier seulement.

## Commits
1. `5dacbf89` migration `20261201170100_sleep_manual_entry.sql`
2. `4aced0a8` logique pure + acces donnees + rappel + 27 tests
3. `076d917a` ecrans Sommeil/Saisie/Reglages + controles + store + manifest
4. `1533198b` accueil, mapping Health Connect, outil IA `sleep_log`, package-lock
5. `291eb69c` merge `milestone/v1.20`

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| SLP-01 saisie | VERIFIED code + tests logique | `lib/sleep.ts` (duree, validation 16 h, steppers 15 min), `SleepLog.tsx` ; tests : 19:00 -> 12:30 = message exact, 16 h ok / 16 h 15 refuse, qualite obligatoire. UI non lancee sur emulateur |
| SLP-02 etat vide | VERIFIED code | plus de `SETTINGS` statique, `8h00`, `score`, `dh*0.24` ; `resolveNight(null,null)` = null ; test. Recherche texte SL-1 a faire en UAT |
| SLP-03 phases conditionnelles | VERIFIED logique | `stages` null sans source ; `StagesBlock` ne rend rien sans ; tests |
| SLP-04 source prime | VERIFIED logique, PARTIAL bout en bout | tests `resolveNight` (source + saisie -> duree de la source, saisie masquee conservee, reglage `manual` force). Ecriture des stades en base : voir non prouve |
| SLP-05 reglages persistes | VERIFIED logique, UAT en attente | aller-retour `parseSettings/settingsToJson` ; sauvegarde par fusion dans `ziko_user_plugins.settings` ; rappel : 4 tests (DAILY, remplacement sans doublon, off = 0, autres plugins intacts) |
| SLP-06 accueil coherent | VERIFIED code | `useSleepToday` appelle le meme `fetchSleepNight` que l'ecran ; cle `['sleep',...]` invalidee a la saisie ; cible = reglage, plus de `HOME_DEFAULTS.sleepTargetH` |

## Tests
`npx vitest run` racine : 38 fichiers, 712 tests verts (dont 27 sommeil : `plugins/sleep/src/lib/{sleep,reminders}.test.ts`, ajoutes a `vitest.config.ts`). Type-check vert : `apps/mobile`, `plugins/sleep`, `plugins/wearables`, `backend/api`.

## Deviations
- D-08 : le hook partage n'est pas dans `apps/mobile/src/hooks/` seul : la resolution vit dans `plugins/sleep/src/lib/data.ts` (importable par le plugin ET l'accueil via l'export `@ziko/plugin-sleep/lib/*`), `useSleepToday`/`useSleepSettings` (useHomeData.ts) l'enrobent.
- Dependance ajoutee `@ziko/plugin-sleep` dans `plugins/wearables/package.json` (mapping des stades) + `package-lock.json` edite a la main (2 entrees) ; `expo-notifications` ajoute a `plugins/sleep`.
- `ziko_wearable_daily_summary` est en lecture seule pour le client (migration revoke) : les colonnes de phases sont ajoutees mais aucun ecrivain n'existe dans le repo.
- Contrainte `duration_hours <= 16` volontairement NON ajoutee en base (risque sur lignes existantes) ; bornee cote client et outil IA.
- Q9 : reveil intelligent = preference seule, libelle `S'activera avec une source connectee` (option A).
- `getRecoveryScore` conserve (cible reglee, repli 8 h interne), non affiche. `useAITips` garde son seuil interne 8 h (conseil, hors affichage).
- Bouton plein = `getActionPrimary(theme)` (#CF4509 si theme le definit).

## NON prouve
- Aucun rendu emulateur/capture (UAT en file) : mise en page C24-C30, 130 % dynamic type, onglets 16 dp.
- Ecriture reelle des phases Health Connect : aucune synchro serveur vers `ziko_wearable_daily_summary` n'existe ; seuls le mapping (teste) et le seed UAT couvrent SL-4.
- Notification locale reellement declenchee a l'heure (test = module simule, pas expo-notifications).
- Migration non appliquee : l'outil IA `sleep_log` ecrit `awakenings`/`source` et echouera tant que 1701 n'est pas appliquee (deploiement backend apres migration).
- Aucun test de rendu RN des ecrans.

## Fichiers sensibles aux conflits
`apps/mobile/app/(app)/index.tsx` et `apps/mobile/src/hooks/useHomeData.ts` (P8/autres), `vitest.config.ts` (resolu avec timer), `package-lock.json`, `plugins/wearables/src/store.ts`, `backend/api/src/tools/sleep.ts`.

## Besoins humains
Appliquer 1701 sur la base de test puis prod (CI sur merge) ; seeds A/B/C du `UAT-PLAN.md` ; ecrivain serveur des phases si Health Connect doit les alimenter.
