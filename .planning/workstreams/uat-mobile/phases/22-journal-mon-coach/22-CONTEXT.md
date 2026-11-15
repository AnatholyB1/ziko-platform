# Phase 22 : Journal & écran Mon coach - Context

**Gathered:** 2026-11-12 (discuss w2b : scout du code réel). Req : JRNL-01, JRNL-02, COACH-01, COACH-02. Vague 2. UI hint oui. **Aucune maquette** (le lot A..D ne couvre ni Journal ni Mon coach : DSGN-01 ne les liste pas) -> **UI-SPEC obligatoire** avant plan/build (voir §"Besoin de UI-SPEC"). Dépend de P2 (session : fait). **Pas de migration.** Frontière avec P25 (Mon coach complet, SEED-002) : P22 = présentation + robustesse de l'écran existant, P25 = fonctionnalités (retrait, programme prescrit, carte coach).
`[A CONFIRMER]` = recommandation du discuss à valider ; sans marque = déjà décidé.

## Décisions verrouillées (recap + roadmap)
- **D-01** JRNL-01 : l'enregistrement d'une entrée réussit avec une session valide ; aucune alerte `Utilisateur non connecté` tant que la session est valide.
- **D-02** JRNL-02 : **emojis d'humeur -> Ionicons** partout dans le plugin ; couleur du module cohérente avec la charte (décision de couleur : question Q-P22a).
- **D-03** COACH-01 : avec un coach lié, Mon coach affiche **le profil du coach** (nom, spécialités, badge KYC vérifié, photo/logo, depuis quand, stats), jamais un écran vide.
- **D-04** COACH-02 : header et bouton retour **cohérents avec les autres écrans** (composant `PluginHeader` de `@ziko/ui` utilisé ailleurs, pas de titre 28 px maison), UI améliorée, placeholder soigné. Safe-area/onglets : consommer les composants corrigés par P5 (XCUT-03/05), ne pas les modifier.
- **D-05** Charte : Ionicons, inline styles, `showAlert` (jamais `Alert`), `paddingBottom: 100`, pas d'emoji, FR.

## Gray areas (reco + `[A CONFIRMER]`)
- **G-01 Cause réelle de JRNL-01 (constat).** P2 a patché `auth.getUser()` (`sessionManager.patchGetUser`) : la cause principale est donc déjà traitée à la racine (SESS-03). Reste un défaut propre au Journal : `JournalPlugin.tsx` l.116-123 met l'id utilisateur dans une requête `staleTime: Infinity` ; si le **premier** appel renvoie `null` (session en cours de refresh), `userId` reste `null` pour toute la vie de l'écran et `handleSave` (l.226) affiche `Utilisateur non connecté.` même après retour d'une session valide. Reco : lire l'utilisateur **au moment de l'enregistrement** via le gestionnaire de session (`requireUser()` de P2 / `useAuthStore`), pas depuis un id mis en cache ; distinguer session expirée (redirection/message P2) d'une erreur réseau/RLS (message précis + réessayer). Même correction pour `JournalEntry.tsx` (l.36). `[A CONFIRMER]` : non, décision technique.
- **G-02 Doublon d'humeur avec le Quick Log (P8)** : voir Q-P22b. P8 a fixé `context: 'afternoon'` (viole le CHECK `pre_workout|post_workout|morning|evening|general`) ; le Journal a ses propres contextes `Matin/...` : **vérifier le mapping vers les 5 valeurs du CHECK** (même bug latent possible) et le tester.
- **G-03 Outil IA `journal_log_mood`** (`backend/api/src/tools/journal.ts`) : `today()` en UTC (décalage près de minuit), pas de logique 1/jour (relevé par P8). P22 est propriétaire du plugin : corriger la date (date locale fournie par le client ou fuseau profil) ; sans nouvel outil, **ne pas toucher `registry.ts`**.
- **G-04 Icônes d'humeur** : réutiliser le jeu déjà posé par P8 sur l'accueil (`apps/mobile/app/(app)/index.tsx` ~l.1020 : `sad-outline`, `sad`, `happy-outline`, `happy`, ...) pour que l'accueil et le Journal montrent la même humeur ; énergie/stress (rangées d'emojis de `JournalEntry.tsx` l.140) -> Ionicons aussi (`battery-*`, `thunderstorm-outline`... à fixer en UI-SPEC). Aucune couleur seule : libellé en plus de l'icône.
- **G-05 Mon coach sans `preview`** : l'écran n'affiche l'état C que si `link && data.preview` (`CoachScreen.tsx` ~l.592) ; si `/coach/clients/links/me` renvoie un `link` sans `preview` (coach sans profil complet, erreur partielle), la page est **vide** : probable cause du retour UAT. Reco : état C dégradé (carte "Coach lié" + date + nom si connu + bouton réessayer) plutôt que vide ; ne jamais rendre un écran sans contenu.
- **G-06 Écran Mon coach** : `CoachScreen.tsx` fait 738 l. avec 3 états (A code / B aperçu / C lié) ; P22 ne change **pas** le flux d'invitation ni l'API (P25 s'en charge). Extraire la carte coach (`CoachCard`) en composant séparé pour que P25 la réutilise.

## Besoin de UI-SPEC (à produire par `/gsd-ui-phase` avant plan, skills `impeccable` + design ; questions Q-P22c pour le périmètre)
Écrans à spécifier (priorité décroissante) : (1) **Mon coach, état C lié** : en-tête `PluginHeader` + retour, carte coach (avatar/logo, nom, badge KYC, spécialités, depuis le, 2 stats) ; (2) **Mon coach, état C dégradé** (profil indisponible) et état de chargement/erreur ; (3) **Journal, onglet Aujourd'hui** : sélecteur d'humeur en Ionicons (5 niveaux, libellés), énergie/stress, contextes, notes, bouton enregistrer, état envoi/erreur/succès ; (4) **Journal, Historique** : liste + tendance 7 jours (`MiniBars`) avec la nouvelle couleur ; (5) états transverses : session expirée, hors-ligne, vide. Contraintes à reprendre des lots A-D : tokens du socle (`shared/DESIGN-SYSTEM.md`), cibles >= 44 dp, texte >= 14 sp, contraste 4,5:1 (la couleur de module proposée par la CRITIQUE Q2 est calculée pour cela), états jamais portés par la couleur seule, mouvement `transform`/`opacity`, reduced-motion. Critères mesurables attendus : JR-1 (0 emoji dans le plugin : recherche `\p{Extended_Pictographic}`), JR-2 (enregistrement après un cycle d'arrière-plan / refresh réussit, 0 alerte "non connecté"), CO-1 (nom du coach visible avec un coach lié, y compris sans `preview`), CO-2 (header + retour identiques à `PluginHeader`).

## Code context (scouté)
- `plugins/journal/src/screens/JournalPlugin.tsx` (471 l.) : onglets `Aujourd'hui/Historique`, `MOODS` avec emojis (l.32-38), `MOOD_EMOJI` (l.46, 411), `VIOLET = '#7B5BD0'` (l.18, utilisé partout : sélection, contextes, bouton, spinner, `MiniBars`, `AISuggestion`) ; `JournalEntry.tsx` (202 l.) : `MOOD_EMOJI` l.11 et rangée énergie/stress l.140.
- Table `ziko_journal_entries(id, user_id, mood 1-5, energy, stress, context CHECK(pre_workout|post_workout|morning|evening|general), notes, date, created_at)`, RLS `journal_entries_own` (FOR ALL) ; routes `apps/mobile/app/(app)/(plugins)/journal/{dashboard,entry}.tsx`.
- `plugins/coach/src/screens/CoachScreen.tsx` (738 l.) : `useQuery(['coach-link'])` sur `${EXPO_PUBLIC_API_URL}/coach/clients/links/me`, `isStateB = preview !== null`, `isStateC = !isStateB && link !== null`, `ScreenTitle` maison (28 px), `SafeAreaView` fond `#F7F6F3`, `CoachAvatar`, `SpecialtyChips`, stats (`ziko_workout_sessions`, `ziko_habit_logs`) ; i18n `coach.*` dans `packages/plugin-sdk/src/i18n.ts` (ajouter ses clés dans son namespace, fin de fichier).
- `apps/mobile/src/lib/sessionManager.ts` (P2 : `patchGetUser`, `requireUser`, `SessionExpiredError`).
- Backend : `GET /coach/clients/links/me` (`backend/api/src/coach/clients/service.ts` l.68, toujours 200, `getActiveLink` de `db.ts`) : **ne pas modifier** (P25 / coach platform) ; le client gère l'absence de `preview`.

## Migrations
Aucune (bloc `202612012201`-`202612012209` réservé, **non utilisé**).

## Références canoniques
`.planning/MILESTONE-RECAP-2026-11-12.md` §14 (Journal) et §15 (Mon coach) ; `lot-C/CRITIQUE.md` Q2 (couleur du Journal : sarcelle `#0F766E` ou ardoise `#3F5F8A`, contrastes calculés) ; `04-maquettes-reference/shared/DESIGN-SYSTEM.md` ; `02-session-auth-robustes/02-CONTEXT.md` + `02-SUMMARY.md` ; `08-accueil-quick-log/08-SUMMARY.md` (humeur, CHECK `context`) ; `ROADMAP.md` Phase 22 / Phase 25.

## Vérification (rappel)
Tests unitaires : mapping contexte -> valeurs du CHECK, lecture de l'utilisateur à l'enregistrement (mock `requireUser` : `ok`, `expired`, `offline`), rendu de l'état C avec/sans `preview` (le harnais de rendu `apps/mobile/src/__tests__/render/` existe), test "0 emoji" sur les sources du plugin. UAT émulateur en file : JR-1, JR-2, CO-1, CO-2 (coach lié du compte de test HARN-03).

## Deferred
Retrait du coach avec confirmation, programme prescrit, carte coach enrichie, pré-installation non désinstallable (tout cela = P25) ; statistiques du Journal avancées ; export.
