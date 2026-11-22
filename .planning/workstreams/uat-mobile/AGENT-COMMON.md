# Regles communes a tous les agents v1.20 (a lire en premier)

Repo `C:\ziko-platform` (Windows 11, Git Bash/PowerShell). Workstream GSD `uat-mobile` : toujours `--ws uat-mobile` avec `gsd-sdk` / skills GSD. Reponses et docs en francais (code/commits en anglais ou francais comme le repo).

## Contrat
- Branche d'integration : `milestone/v1.20`. Ton worktree est isole (`isolation: worktree`). PREMIERE ETAPE : `git checkout -B <ta-branche> milestone/v1.20` puis verifier `git log --oneline -1` = sujet "docs(v1.20): AGENT-COMMON ..." (ou plus recent). Ne jamais ecrire sur `milestone/v1.20`, `main`, ni la branche d'un autre agent. Ne jamais pusher. Pas de `git add -A` ni `.` : `git add <chemins explicites>`. Commits atomiques, messages terminant par :
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` puis `Claude-Session: https://claude.ai/code/session_01Kbknvn8PohpeW5Qxfi6aUh`.
- Prefixe `rtk` pour les commandes shell quand ca marche (`rtk git ...`, `rtk grep`, `rtk read`) ; y compris dans les chaines `&&`. Si un wrapper casse (ex. `rtk npx vitest`), commande brute et note-le. `rtk proxy <cmd>` pour la sortie non filtree.
- Lire : `C:\ziko-platform\CLAUDE.md` (conventions), `.planning/workstreams/uat-mobile/ROADMAP.md` (ta phase), `REQUIREMENTS.md` (tes ids), `.planning/MILESTONE-RECAP-2026-11-12.md`, et ton `phases/NN-*/NN-CONTEXT.md` (decisions verrouillees D-xx : a respecter, ne pas les rediscuter).
- Installation : un VRAI `npm install --no-save` dans ton worktree si tu dois builder/tester (jamais `npm ci`). **JAMAIS `rm -rf` sur un `node_modules` ni sur un dossier qui en contient** : sur cette machine les `@ziko/*` sont des liens vers le repo ; `rm -rf` peut suivre les liens et detruire des fichiers d'un autre checkout. Pour retirer un lien : `cmd /c rmdir <lien>`.
- Fichiers d'env : les `.env*` reels n'existent pas dans ton worktree (secrets, gitignores). N'invente aucun secret, ne demande rien dans le chat, n'imprime jamais un secret. Pour build/tests utilise des valeurs factices explicites (`EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321`, cle factice) passees en variables d'environnement de la commande.

## Interdits absolus
Aucune ecriture en base reelle : le projet Supabase `portfolio` (ubxllsvanurkwkohzxau) est la PRODUCTION (lecture seule via outils, et seulement si ta mission l'exige). Migrations = fichiers SQL seulement, jamais appliquees par toi, jamais d'edition d'une migration existante, nommage `supabase/migrations/20261201PPSS_description.sql` (PP = numero de phase sur 2 chiffres, SS = 01-09, dans TON bloc). Pas d'appel reel Anthropic/OpenAI/Resend/Upstash/Expo push/Sentry ; pas de deploiement ; pas de build EAS cloud ; pas de creation de branche Supabase. Ne tue jamais un process par nom d'image (`taskkill /IM`, `pkill node`) : seulement le PID qui ecoute SUR TON PORT RESERVE (`Get-NetTCPConnection -LocalPort N -State Listen`). N'utilise que tes ports reserves (donnes dans ta mission) ; le port 3103 est occupe par autre chose.
Un seul emulateur Android a la fois sur la machine, uniquement si ta mission l'autorise, apres `mkdir C:/ziko-platform/.claude/worktrees/integration-v1.20/.planning/.machine-lock` (atomique ; s'il existe et a < 25 min, attends 60 s et reessaie ; `rmdir` apres usage).

## Charte mobile
Theme clair uniquement ; fond `#F7F6F3`, surface `#FFFFFF`, bord `#E2E0DA`, primaire `#FF5C1A`, texte `#1C1A17`, muted `#6B6963`. Styles inline (pas de `StyleSheet.create`), tokens via `useThemeStore((s) => s.theme)`, Ionicons (jamais d'emoji), `showAlert` de `@ziko/plugin-sdk` (jamais `Alert`), racines d'ecran `paddingBottom: 100`, cartes rayon 16 + bord 1px + ombre `#1C1A17` 0.08/12/elevation 3. Manifests de plugin : `export default`. Fichiers avec accents/emoji : editer avec les outils de fichiers (Edit/Write), jamais heredoc/echo shell. `findLast` indisponible (cible TS mobile). Backend : imports relatifs en `.js`.

## Verification (honnetete)
Verification reproductible (tests ecrits et commits, pas de fixtures supprimees). Dis precisement ce qu'un test/mock ne prouve pas. Les UAT emulateur sont en file et se font apres P1 : prepare les flows/scripts mais n'attends pas l'emulateur.
Avant de finir : `git merge milestone/v1.20` dans ta branche (resous par intention), gate de ta zone verte (type-check des paquets touches, tests vitest concernes ; lint si config), tout commite.

## Reprise / limites de contexte
Commit WIP avant toute longue operation. Ecris/maj ton fichier de reprise `phases/NN-*/NN-RESUME.md` (etat, branche, dernier commit, suite). Si ton contexte depasse ~65 % ou si un message de limite apparait : commit, maj du fichier de reprise, reponse courte d'etat, stop.

## Reponse finale (<= 30 lignes)
Branche + commits, exigences (VERIFIED/PARTIAL + preuve), comptes de tests, deviations, ce qui n'est PAS prouve, besoins humains, fichiers susceptibles de conflit.
