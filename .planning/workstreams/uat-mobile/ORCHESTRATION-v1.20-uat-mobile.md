# ORCHESTRATION v1.20 — uat-mobile (fichier de reprise)

Mis a jour : 2026-11-12 (setup + plan, aucun agent lance). Lire ce fichier en premier a la reprise, puis `MILESTONE-RUN.md`, puis le dernier commit de chaque branche (ne jamais croire une notification "done" sans lire le dernier commit).

## Contrat court
- Branche d'integration : `milestone/v1.20` (worktree `.claude/worktrees/integration-v1.20`). Base = `origin/main` @ `ba8f7925` (PR #68) + cherry-pick propre des 3 commits de planning (`35418b5f`->`970a7e99`, `249a456b`->`304e2f20`, `32aa915d`->`39c30132`). Aucun conflit.
- Jamais de push, jamais `main`, jamais de deploiement, AUCUNE ecriture dans le projet Supabase `portfolio` (ubxllsvanurkwkohzxau = PRODUCTION, lecture seule). Migrations = fichiers seulement, appliquees par l'orchestrateur apres approbation utilisateur.
- `gsd-sdk ... --ws uat-mobile` partout. `git add <chemins>` explicites (fichiers untracked de l'utilisateur dans le repo principal).
- Reponses utilisateur en francais, courtes. Decisions produit = `.planning/MILESTONE-RECAP-2026-11-12.md` (ne pas redemander).

## Profil projet
| Element | Valeur |
|---|---|
| Gestionnaire | npm 11.17 workspaces + Turborepo ; Node local **v26.4** (CI = Node 20 : ne pas se fier a la version locale pour les ecarts de comportement) |
| Install worktree | `npm install --no-save` (jamais `npm ci` dans un worktree partage). **Pas de junction de node_modules** : les symlinks `@ziko/*` pointeraient vers le repo principal -> vrai install par worktree |
| Gate | `npx turbo run type-check` ; `npx turbo run lint` (mobile: lint = no-op) ; `npx turbo run test` (vitest backend + web ; mobile `vitest run --passWithNoTests`) ; `npm run build` (turbo) ; re-`type-check` apres build. Backend seul : `cd backend/api && npm run test`. RLS : `npm run test:rls` (exige base de test, voir checklist) |
| rtk | `rtk 0.33.1` present. Utiliser `rtk git ...`, `rtk grep`, `rtk read`. Si un wrapper casse (`rtk npx vitest`), commande brute + noter ici |
| Env a copier (jamais imprimes) | `apps/mobile/.env`, `apps/web/.env.local`, `backend/api/.env.local`, `apps/web/.env.test` (gitignores). Copier depuis le repo principal vers chaque worktree builder |
| Services reels a ne jamais appeler | Supabase `portfolio` (ecriture), Anthropic/OpenAI (cout reel : mocks en test, 1 seul appel reel par UAT d'outil IA et uniquement apres validation), Resend (mail), Upstash, Vercel deploy, Expo push, Sentry (pas de release) |
| UAT outillage | adb 1.0.41 + emulator 36.4.10 + system-image `android-36/google_apis_playstore/x86_64` (**deja telecharges**), platform 36.1, build-tools 36.1.0. JDK 21 : `C:\Program Files\Android\openjdk\jdk-21.0.8`. ABSENTS : AVD, cmdline-tools (avdmanager), NDK, CMake, Maestro, eas-cli, docker. Navigateur : Chrome MCP present mais non utilise (UAT = emulateur seul) |
| Machine | Windows 11, Ryzen 7 5800H 8c/16t, 16 Go RAM (**~1,8 Go libres a l'instant T** : Memory Compression 1,1 Go, Chrome, Discord, Defender), **disque C: 15 Go libres**, 49 worktrees `.claude/worktrees/*` perimes d'anciens milestones |

## Table de ports reserves (3103 deja occupe par un `node` hors orchestration : ne pas l'utiliser, ne pas le tuer)
| Role | Plage |
|---|---|
| Orchestrateur (gate, build integration, serveur de test) | 3200 ; backend Hono 8200 ; Metro 8281 |
| Builders (1 slot chacun, 6 max) | web 3203-3208 ; backend Hono 8203-8208 ; Metro 8283-8288 |
| Auditeurs / fixeurs | 3230-3239 ; backend 8230-8239 ; Metro 8290-8299 |
| Emulateur Android | AVD #1 `ziko-uat-1` : console 5554 / adb 5555 ; AVD #2 (si RAM) 5556/5557 |
Kill uniquement par PID ecoutant sur son port (`Get-NetTCPConnection -LocalPort N -State Listen`). Jamais `taskkill /IM`.

## Verrou machine
`mkdir C:/ziko-platform/.claude/worktrees/integration-v1.20/.planning/.machine-lock` (atomique ; >25 min = perime). Pris par : gate lourd, build, run UAT emulateur (1 seul a la fois). `rmdir` apres.

## Migrations
Convention `supabase/migrations/20261201PPSS_description.sql` (PP = phase 2 chiffres, SS = 01-09). Verifie : version max hebergee = `20261111135505`, donc tous les `20261201*` sont strictement posterieurs (ordre strict OK) ; aucun fichier `20261201*` dans le repo. Aucune migration appliquee a ce jour par ce milestone.

## Carte de propriete des fichiers partages
| Fichier / zone | Proprietaire | Autres phases (regle) |
|---|---|---|
| `backend/api/src/tools/registry.ts` (640 l.) | P14 (1er ajout d'outil du milestone), puis P16, P23 | additif : un import + une entree en fin de liste ; conflit trivial resolu au merge. P7/P8/P10/P11/P15/P17/P18/P20 etendent les fichiers d'outils existants (`pantry.ts`, `hydration.ts`, `measurements.ts`, `sleep.ts`, `stretching.ts`, `timer.ts`, `nutrition.ts`) SANS toucher registry sauf nouveau tool |
| `plugins/gamification` (`GamificationPlugin.tsx`, `ShopScreen.tsx`, `store.ts`) | P12 (onglets, succes, boutique) | P13 = onglet Quetes, meme fichier -> **P13 chaine apres P12** (reecriture du meme composant) ; P14 backend seul ; P21 lecture seule (badges profil) |
| `packages/plugin-sdk/src/i18n.ts` (1886 l.) | personne (hot spot) | chaque phase AJOUTE son propre namespace a la fin (`rewards.*`, `pantry.*`...) ; conflits de virgules/ordre resolus au merge, validation par `tsc` |
| `apps/mobile/src/lib/PluginLoader.tsx` | P25 | autres phases : aucun changement attendu |
| `apps/mobile/app/(app)/index.tsx` (accueil) | P8 (Quick Log, tuiles) | P5 (slug, safe-area, "Coach Ziko" x2) et P6 (boutons "Allez c'est parti", "Demarrer la seance") = edits localises, pas de reecriture ; merge ordre P5 -> P6 -> P8 |
| Composants d'onglets/header partages (`WSHeader.tsx`, tab bars) | P5 (XCUT-04/06) | P17/P18/P22 consomment le composant, ne le modifient pas |
| `apps/mobile/app/(app)/workout/*`, `workoutStore.ts` | P6 | P7 (liste/activation), P18 (routine par defaut en debut de seance), P23 : apres P6 ; P18 additif (hook en debut de seance) |
| `ErrorBoundary.tsx`, `ErrorScreen.tsx` (garde modules) | P3 | - |
| `authStore.ts`, client supabase mobile | P2 | P21/P22 lisent |
| `backend/api/src/middleware/creditGate.ts` | personne | P10/P14/P16/P23 l'utilisent, ne le modifient pas ; si besoin de nouveau `kind`, ajout additif |
| Schema DB / migrations | par phase (blocs 20261201PPSS) | tables `ziko_*`. P15->P16 meme table (`ziko_athlete_goals`) : P16 ajoute des colonnes/tables via son bloc |
| `docs/.planning` (STATE, ROADMAP, REQUIREMENTS) | orchestrateur uniquement | les agents n'ecrivent que dans le dossier de leur phase |

## Plan de pipeline (vagues = vue de planification, pas des barrieres)
Voies : BUILD (builders worktree) / DESIGN (contrats maquettes) / DISCUSS (questions utilisateur groupees) / AUDIT / UAT (file emulateur).
| Vague | Phases | Pourquoi ce groupe / pourquoi chaine (fichier ou dependance) | Fichiers en conflit | Portes humaines |
|---|---|---|---|---|
| 0a | P1 Harness, P2 Session, P3 Habitudes, P4 Maquettes lot A+B (design) | independants : P1 = `scripts/uat/`, `.maestro/` ; P2 = `authStore`/client ; P3 = `plugins/habits` + ErrorBoundary ; P4 = dossier design seul | aucun | P1 : decision compte de test + build dev-client (voir checklist) ; validation visuelle lot A+B |
| 0b | P4 lots C+D | meme agent design apres A+B (ou 2 agents en parallele si budget) | aucun | validation visuelle lots C+D |
| 1 | P5, P6, P8, P11, P15 | disjoints (P5 transverse/accueil localise ; P6 workout ; P8 tuiles accueil ; P11 hydratation ; P15 mesures) ; demarrent des que leur discuss est faite, **sans attendre P1** (UAT en file apres P1). P11/P15 : leur propre UI-SPEC (`/gsd-ui-phase`) avant build | `index.tsx` accueil (P5/P6/P8), `i18n.ts`, `WSHeader` (P5) | UI-SPEC P11, P15 ; questions P15 (MEAS-01) |
| 2 | P7, P9, P10, P12, P17, P18, P19, P20, P21, P22 | chacun son plugin/ecran. Chaines nommees : P7<-P6 (`workout/*`), P9<-P8 (tuile repas + `nutrition_logs`), P10<-P9 (macros restantes), P17<-P8 (accueil), P18<-P6 (demarrage seance), P21<-P2 (cause echec ajout ami) + P12 (badges profil, lecture seule). **Demarrage anticipe sur mocks** : parties backend/migrations de P7, P12, P19, P20, P21 des maintenant ; UI quand le lot de maquettes est valide | `i18n.ts` ; `workout/*` (P7/P18) | validation maquettes par lot ; P22 UI-SPEC |
| 3 | P13, P23 | P13 chaine apres P12 : meme fichier `GamificationPlugin.tsx` (onglet Quetes). P23 depend de P7 (activation) + P6 + maquette lot A ; **backend de P23 (outil atelier, skills, web search) peut demarrer des la vague 1** | `registry.ts` (P23), `GamificationPlugin.tsx` | questions credits IA automatiques |
| 4 | P14, P24 | P14 chaine apres P13 (schema quetes, meme table) mais **demarre sur contrat de schema** deja fige par P13 ; P24 apres P23 (meme conversation/tables de programme) | `registry.ts` (P14), tables programme (P24) | reconciliation QUEST-07 vs v1.18 (discuss P14) |
| 5 | P16, P25 | P16 apres P14 (patron d'outil) et P15 (table objectifs) ; P25 apres P7+P22 (programme coach vs IA, ecran coach) | `registry.ts` (P16), `PluginLoader` (P25) | validation SEED-002 (P25) |
| 6 | P26 | depend de P12/14/16/21/25 (lecture) ; derniere | tables factions/ligues | validation SEED-001 (P26) |
Audit : lance des qu'une phase est mergee + gate vert, en parallele des builds suivants. UAT emulateur : file unique, 1 run a la fois.

## Cap d'agents simultanes (justifie par la machine, pas par le cout)
- **6 builders max** en theorie ; **4 builders avec install reel** tant que le disque libre < 25 Go (chaque worktree node_modules ~ plusieurs Go : NON MESURE, `du` trop lent ; a mesurer avant la vague 1). Agents de design : 3 (pas de node_modules). Auditeurs/fixeurs : 2. Total actif <= 8. Emulateur : 1 (2 si RAM libre > 6 Go).
- Echelonner vagues lourdes (limite d'usage 5 h) : vague 1 et 2 ne partent pas ensemble a plein ; P5..P15 d'abord, puis pipeline roulant.
- Si le gate time-out sous charge : passer a 3 builders.

## Estimation de cout (agents x tokens ; ordre de grandeur, non mesure)
| Etape | Agents | Tokens/agent | Total |
|---|---|---|---|
| Vague 0 (P1-P4 : 3 builders + 2 design) | 5 | 250-450k | ~1,8 M |
| Vague 1 (5 builders + audits combines + 3 UI-SPEC) | ~14 | 200-450k | ~4 M |
| Vague 2 (10 builders + 6 contrats design + audits) | ~30 | 200-450k | ~9 M |
| Vagues 3-4 (P13, P23, P14, P24, IA : plus lourds) | ~14 | 300-550k | ~5 M |
| Vagues 5-6 (P16, P25, P26 + discuss seeds) | ~10 | 300-550k | ~3,5 M |
| UAT emulateur (26 runs) + fixes | ~30 | 100-200k | ~4 M |
Total indicatif **25-30 M tokens**, ~120 agents ; 1 auditeur combine par phase (pas 3) pour limiter le cout.

## Discuss lane (questions a poser a l'utilisateur, groupees, jamais bloquantes pour un builder)
Zones grises restantes (STATE.md) : MEAS-01 reutilisation de `ziko_athlete_goals` (P15, recherche d'abord) ; credits IA pour appels automatiques (P14/P23/P24) ; UI-SPEC P11, P15, P22 ; libelle quete "echouee" vs non-punitif v1.18 (P14) ; MCOA-*/LEAG-* contre SEED-002/SEED-001 (P25/P26, lus en discuss).

## Etat
Voir `MILESTONE-RUN.md`. Prochaine action : validation des decisions utilisateur de `DEPLOY-CHECKLIST-v1.20.md`, puis lancement vague 0a (P1+P2+P3 builders, P4 design lots A+B, discuss P1-P3).
