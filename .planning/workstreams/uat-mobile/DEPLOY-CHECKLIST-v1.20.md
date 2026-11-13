# DEPLOY-CHECKLIST v1.20 — blocages humains et actions differees

Statut : `[ ]` a faire, `[x]` fait. Rien n'est ecrit en production a ce jour. Ne jamais envoyer de secret dans le chat.

## A. Decisions utilisateur necessaires AVANT la vague 0
- [ ] **A1. Base de test pour les UAT (HARN-03)** — bloque tous les UAT. Le projet `portfolio` (ubxllsvanurkwkohzxau) est la production. Options :
  1. **(Recommande) Branche Supabase de `portfolio`** (outil `create_branch`, jetable, migrations testees dessus avant la prod ; cout horaire faible, a confirmer dans votre plan). Compte jetable `uat-athlete` + `uat-coach` lies, crees par API admin sur la branche, script de reset reproductible. Aucun risque pour la prod ; l'app de dev pointe sur l'URL/cle de la branche (fournies par vous ou par la CLI, jamais dans le chat).
  2. Compte jetable `uat-athlete` (+ coach lie) sur la prod `portfolio`, via admin/API, donnees `ziko_*` nettoyables par script. Risque : migrations a tester directement en prod, pollution, quotas d'IA reels.
  3. Nouveau projet Supabase de test (peut etre bloque par la limite de projets du plan gratuit).
  Pas de docker sur la machine (pas de stack locale). Je n'ai rien cree.
- [ ] **A2. Build de l'app de dev pour l'emulateur** (MMKV impose un dev-client natif, pas Expo Go). Options : (1) **(Recommande) EAS cloud** profil `development` avec APK (necessite `eas login` de votre part ; quota gratuit limite) ; (2) build local : JDK 21 present, mais NDK + CMake + cache Gradle absents (~3-4 Go a telecharger, disque libre 15 Go) -> risque disque.
- [ ] **A3. Liberer de la place/RAM** : 15 Go libres sur C:, ~1,8 Go de RAM libre mesures. Recommande : OK pour supprimer les worktrees perimes `.claude/worktrees/agent-*` (49 dossiers, anciens milestones v1.16-v1.18 ; leur etat merge/non merge N'A PAS ete verifie) apres que je liste ceux qui n'ont pas de commits non merges ; fermer Chrome/Discord pendant les UAT.
- [ ] **A4. Maestro** : installation requise (binaire, JDK 17+ present). Je l'installe en phase 1 hors repo (aucune action sensible), sauf objection.

## B. Secrets / comptes (action utilisateur, sans les coller dans le chat)
- [ ] Identifiants du compte de test (hors repo, fichier gitignore local) — apres decision A1.
- [ ] Cle API Anthropic de test avec plafond de depense (UAT IA reels P14/P16/P23) ; sinon mocks seulement.
- [ ] `EXPO_PUBLIC_*` pour la base de test choisie en A1.
- [ ] Verifier avant toute mise en prod : diff des `process.env.X` lus par le code vs variables Vercel (backend + web).

## C. Migrations a approuver (fichiers ecrits par les agents, appliquees par l'orchestrateur apres votre accord, d'abord sur la base de test A1)
Blocs `20261201PPSS` : P7 0701, P8 0801, P9 0901 (reserve), P10 1001, P11 1101, P12 1201, P13 1301, P14 1401, P15 1501, P16 1601, P17 1701, P18 1801, P19 1901, P20 2001, P21 2101, P23 2301, P24 2401, P25 2501, P26 2601. Version max hebergee actuelle : `20261111135505`.
- [ ] Revue/approbation par lot avant application. Rappel : CI applique automatiquement `supabase/migrations/` sur push vers `main` (hors perimetre : on ne pousse pas).

## D. Decisions produit a trancher en discuss-phase
- [ ] P15 : reutiliser `ziko_athlete_goals` pour MEAS-01 ? (recherche, recommandation attendue : etendre la table)
- [ ] Credits IA : appels automatiques (quetes au level-up, relance d'atelier) deduits ou absorbes ? (recommande : absorbes avec plafond journalier, loggues `ai_cost_log`)
- [ ] P14 : libelle "echouee" neutre, sans penalite (coherent v1.18 phases 45/46).
- [ ] P11/P15/P22 : UI-SPEC propres. P4 : rappels Complements par moment de la journee, couleur du Journal.
- [ ] P25/P26 : validation de MCOA-*/LEAG-* contre `SEED-002-mobile-mon-coach-plugin.md` et `SEED-001-factions-ligues-rpg-social.md`.

## E. Validations visuelles (une par lot de maquettes)
- [ ] Lot A programmes + atelier + repas ; [ ] lot B recompenses + pantry ; [ ] lot C stretching + complements + timer + sommeil ; [ ] lot D profil public + amis.

## F. Apres le milestone (hors perimetre sauf demande explicite)
- [ ] Push / PR, application des migrations en prod, deploiement Vercel/EAS, nettoyage du compte et de la branche de test, suppression des worktrees d'integration.

## G. Suite de l'incident du 2026-11-12 (env perdus)
- [ ] L'utilisateur regenere `apps/web/.env.local`, `apps/web/.env.test`, `backend/api/.env.local`, `.vercel` (repo principal). Tant que ce n'est pas fait : phases backend/web/RLS = mocks ou reportees ; le `.env` mobile (valeurs publiques) a ete recree par la session principale.
- [ ] `npm install` du repo principal a refaire par l'utilisateur (node_modules racine vide).

## H. Actions PRODUCTION effectuees (avec accord explicite de l'utilisateur)
- [x] 2026-11-13: migration `202612012501_coach_link_guard.sql` appliquee en PROD (ref ubxllsvanurkwkohzxau) via execute_sql dans UNE transaction (BEGIN/COMMIT), en reponse a la faille RLS de `ziko_coach_client_links` (UPDATE ouvert a toutes les colonnes pour coach et athlete => un coach pouvait reecrire client_id et obtenir is_coach_of sur un athlete arbitraire). Colonnes verifiees avant (id, coach_id, client_id, expires_at, revoked_at, created_at, shared_note). Verifie apres (lecture): colonne revoked_by, trigger ziko_coach_link_guard_trg actif (enabled=O), policies client_revoke + coach_update (UPDATE) + participant_read (SELECT), 7 liens inchanges (7 actifs). Non inscrit dans schema_migrations (execute_sql, pas apply_migration): le fichier du depot reste la reference; CI (push main) le rejouera sans effet (idempotent).
- A faire plus tard (deploiement complet): 2502, 2503 et toutes les autres migrations v1.20 (liste en section C), policy badge 1203 en prod.

## I. A faire AVANT release (decisions du 2026-11-13)
- [ ] `npx expo install --check` dans apps/mobile: aligner expo-image-manipulator (et tout module natif hors SDK 54) sur la version attendue par Expo ~54; rebuild EAS dev-client; verifier profile/avatar et la photo de repas (nutrition) sur emulateur.
- [ ] Au deploiement des migrations en prod: les appliquer dans l'ordre des noms; verifier que l'outil de migration accepte les versions 2026120xxxxx apres 20261111135505 et que 2501 (deja en prod) se rejoue sans effet.
