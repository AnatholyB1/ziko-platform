# Requirements — v1.7 Mobile UX v2

**Workstream:** milestone-mobile  
**Milestone:** v1.7 Mobile UX v2  
**Status:** Active  
**Last updated:** 2026-05-21

---

## Scope Summary

Full visual redesign of the Ziko mobile app to match the 24 mockup files in `C:/Users/Anatholy/Downloads/ziko/`. Design and real data connections are done together per screen (not two separate passes). Only `workout-active.jsx` (the live workout session) is excluded.

---

## DS — Design System Foundation

- [ ] **DS-01**: A `packages/ui/src/design-system.ts` (or equivalent NativeWind theme extension) codifies all design tokens from the mockup: `primary #FF5C1A`, `bg #F7F6F3`, `surface #FFFFFF`, `border #E2E0DA`, `text #1C1A17`, `muted #6B6963`, `shadow { opacity: 0.08, radius: 12, elevation: 3 }`, spacing scale, and border-radius values.
- [ ] **DS-02**: A shared `FormRing` component renders a 4-segment composite wellness ring (SVG, segments: sleep/water/nutrition/load, colors orange/blue/green/purple) with a center numeric score (0–100). Props: `score`, `parts: {value, max, color}[]`, `size`.
- [ ] **DS-03**: A shared `AISuggestion` component renders a standardized inline AI suggestion card (sparkles icon, colored tint strip, body text, optional action button label + onPress). Used across all plugin screens.
- [ ] **DS-04**: A shared `SubTabs` component renders a segmented horizontal tab bar (2–4 tabs, orange underline active indicator, muted inactive text). Props: `tabs: string[]`, `active`, `onChange`.
- [ ] **DS-05**: A shared `PluginHeader` component renders a back-chevron header with a title and optional right element. Props: `title`, `onBack`, `right?`.
- [ ] **DS-06**: A shared `WeekStrip` component renders a 7-day horizontal grid (day label + date number + optional dot indicator, today highlighted with orange pill). Props: `selectedDate`, `onSelect`.
- [ ] **DS-07**: A `BugFab` + `BugSheet` pair: `BugFab` is a 42px dark floating button (bottom-right, above tab bar) that shows/hides via opacity transition; `BugSheet` is a bottom sheet with auto-captured screen context, 5 type chips, textarea, screenshot-attach toggle, and a send button (disabled until text entered).
- [ ] **DS-08**: A `PaywallScreen` full-screen dark modal with radial orange glow, 8-row Free vs Pro feature table, 3 plan cards with radio selection (monthly 9.99€ / annual 59.99€ / lifetime 199€), and a 7-day free trial CTA.
- [ ] **DS-09**: A `RechargeSheet` bottom sheet with 3 credit packs (25 / 100 / 500 crédits at 2.99€ / 9.99€ / 39.99€) and an upgrade-to-premium suggestion card.
- [ ] **DS-10**: The app navigation restructured to 3 primary tabs (Accueil / Séance / Profil) matching the mockup `app.jsx`. The PluginsDrawer on the home screen replaces any separate plugin-browsing tab.
- [ ] **DS-11**: A `PluginsDrawer` bottom drawer renders a 4×grid of all 18 installed plugins (icon + name). Opens via a "Tous les modules" CTA on the home screen.
- [ ] **DS-12**: `BugFab` is mounted at the root layout level and accessible from every screen in the app.

---

## HOME — Home Screen

- [ ] **HOME-01**: The home screen `FormeDuJour` section renders `FormRing` using real data: `sleep_logs` (latest duration vs target), `hydration_logs` (today's ml vs goal), `nutrition_logs` (today's calories vs TDEE), and workout load (weekly sessions done vs goal). Score computed as weighted average of the 4 segment percentages.
- [ ] **HOME-02**: The `MissionCard` dark hero card shows the next scheduled workout from the user's active `ai_generated_programs` assignment (day label, session name, exercise count, "Commencer" CTA). If no active program, the card shows an "Aucun programme actif" state with a "Créer un programme" link.
- [ ] **HOME-03**: `AICoachInline` rotates through 3 contextual AI tips derived from the user's recent data (most recent sleep score, hydration deficit, or unmet habit). Two CTAs: "J'applique" (logs the action via the relevant API endpoint) and "Plus tard" (dismisses for 24h). This is NOT an AI chat — tips are rule-based.
- [ ] **HOME-04**: `QuickLog` renders 4 tap buttons: water +250ml (calls `hydration_log` tool), mood 1–5 (calls `journal_log_mood`), weight kg (calls `measurements_log`), meal quick-add (navigates to nutrition add tab). Each button shows a confirmation flash on success.
- [ ] **HOME-05**: `SmartActions` renders a horizontal scroll of 2 contextual action cards based on time-of-day and recent data (e.g. morning → "Compléter hydratation" / evening → "Logger sommeil"). Cards show an icon, title, subtitle, and a "→" link.
- [ ] **HOME-06**: `WeekStrip` shows the current week with real workout session completion dots from `workout_sessions` (done = orange dot, today = orange pill).
- [ ] **HOME-07**: The "Récent" section lists the user's 3 most recent workout sessions (`workout_sessions` joined with program data) showing type icon, date, duration, and volume.
- [ ] **HOME-08**: `PluginsDrawer` opens on "Tous les modules" tap and shows all installed plugins from `user_plugins` joined with manifests. Tapping a plugin navigates to its main route.
- [ ] **HOME-09**: The home screen header shows the user's first name from `user_profiles` and a streak count from the computed `habit_logs` or `workout_sessions` consecutive-day streak.
- [ ] **HOME-10**: All fixtures (`PROFILE`, `STREAK`, `TODAY`, `FORME`, `RECENT`, `ALL_PLUGINS`) removed — all data served by TanStack Query hooks targeting Supabase or the Hono API.

---

## AUTH — Auth Flow Redesign

- [ ] **AUTH-01**: `AuthWelcome` screen has a full-screen dark gradient background (`#1C1A17` → `#2C2A27`), the Ziko logo in white, a tagline, Apple/Google/Email buttons, and a "240 000+ utilisateurs" social proof chip.
- [ ] **AUTH-02**: `AuthSignin` screen matches the mockup: email/password fields, "Mot de passe oublié?" link, primary "Se connecter" CTA, and a bottom link to sign up.
- [ ] **AUTH-03**: `AuthSignup` screen includes a 4-segment password strength indicator (weak/fair/good/strong with orange fill progress).
- [ ] **AUTH-04**: `AuthForgot` screen with email field and "Envoyer le lien" CTA, matching the mockup layout.
- [ ] **AUTH-05**: All auth screens use the light sport theme on the form card area but preserve the dark welcome gradient as the background for `AuthWelcome` only.

---

## OB — Onboarding Redesign

- [ ] **OB-01**: Onboarding is a 7-step flow (bienvenue → objectif → niveau → fréquence → équipement → mensuration → prêt) matching `onboarding.jsx`.
- [ ] **OB-02**: `OnboardingShell` renders a progress bar (segments, orange fill) at the top and a skip link on steps 2–6.
- [ ] **OB-03**: Step "objectif" has 4 goal cards with icon + label (Force / Cardio / Poids / Bien-être).
- [ ] **OB-04**: Step "niveau" has 3 level cards (Débutant / Intermédiaire / Avancé).
- [ ] **OB-05**: Step "fréquence" has a days-per-week picker (2–6, highlighted selection).
- [ ] **OB-06**: Step "équipement" has a multi-select grid (Salle complète / Haltères / Élastiques / Sans matériel).
- [ ] **OB-07**: Step "mensuration" collects weight (kg) and height (cm) with numeric inputs.
- [ ] **OB-08**: Step "prêt" (OBReady) shows a summary card with the chosen goal, level, and frequency, plus a "Commencer" CTA that triggers the first-run auto-install of mandatory plugins.

---

## PROF — Profile Screen

- [ ] **PROF-01**: Profile screen has a 160px hero cover (gradient or user-set photo) and an 84px avatar (initials fallback circle), matching `profile.jsx`.
- [ ] **PROF-02**: A stats row below the avatar shows: séances total (from `workout_sessions`), XP total (from `user_xp`), streak (consecutive days).
- [ ] **PROF-03**: Three tabs: Stats / Progression / Badges. Stats tab shows a 7-day `MiniBars` bar chart for workout volume and a 4-up stat tiles grid. Progression tab shows a `WeekStrip` + recent PRs list. Badges tab shows a 2×4 badges grid with locked/unlocked states from `user_xp` or gamification table.
- [ ] **PROF-04**: A followers/following row is rendered (using `friendships` table count). Read-only in v1.7.
- [ ] **PROF-05**: Profile data (`user_profiles`, `user_xp`, `workout_sessions`) loaded via TanStack Query — no hardcoded fixtures.
- [ ] **PROF-06**: Own mode vs public mode: own profile shows "Modifier" CTA; public profile (viewed from community) shows "Suivre" CTA (read-only stats only in public mode).

---

## SET — Settings Redesign

- [ ] **SET-01**: Settings screen uses the `STGroup` / `STRow` component system matching `settings.jsx`: grouped rows with label, optional subtitle, optional right element (toggle / chevron / value text).
- [ ] **SET-02**: `NotifSubScreen` has 8 notification toggles (Coach IA / Rappels séances / Records / Défis / Messages / Promos / Système / Nouveaux modules) with real state persisted in `user_profiles.settings JSONB`.
- [ ] **SET-03**: `AppearanceSubScreen` has 3 theme selector cards (light sport only for v1.7 — other themes visible but locked via `PaywallScreen`), language selector (FR/EN), and units selector (kg/lbs, km/mi).
- [ ] **SET-04**: `IntegrationsSubScreen` has 6 integration rows (Apple Health / Health Connect / Strava / Garmin / Google Fit / MyFitnessPal) with connect/disconnect state from `wearables` or `health_sync_log`.
- [ ] **SET-05**: Account section has "Supprimer mon compte" (existing flow) and "Mon coach" section (if linked) showing coach name + "Gérer" link.

---

## WORK — Workout Stack (Non-Active Screens)

- [ ] **WORK-01**: Séance tab home matches `workout-program-ai.jsx` `ProgramDetail`: dark hero with "Semaine N/8" + gradient progress bar, weekly schedule, upcoming sessions list, "Démarrer séance" CTA. Data: active `ai_generated_programs` row.
- [ ] **WORK-02**: `ProgramDetail` has 2 tabs (Semaine type schedule / N semaines plan with done/current/future state chips). Real data from `ai_generated_programs.program_data JSONB`.
- [ ] **WORK-03**: `AIGenerator` is a 4-step wizard (ressenti 1–10 slider / durée 5 options / zone haut/bas/full/cardio / matériel 4 options) → orange sparkle loading animation → generated session. Calls `POST /ai/tools/execute` with `ai_programs_generate` tool.
- [ ] **WORK-04**: `HistoryDetail` shows a 4-up stats header (durée/volume/séries/FC moy.), a session note quote, and per-exercise breakdown with set chips (S1 90kg×8·7). Data: `workout_sessions` + `session_sets` joined by session ID.
- [ ] **WORK-05**: `ExerciseDetail` has a 16:9 dark video placeholder, 3 stat tiles (record PR / nb séances / tendance arrow), 3 tabs (consignes with numbered cues + AISuggestion / muscles anatomy / historique bar chart + session list). Data: `exercises` table + `session_sets` history.
- [ ] **WORK-06**: `ExercisePicker` is a full-screen modal with a search input, filter chips (Favoris / muscle groups), and a multi-select checkbox list. "Ajouter N exercices" sticky footer CTA.
- [ ] **WORK-07**: `WorkoutSummary` has a dark "Highlight" hero card with 4-up session stats, a PRs section (orange trophy cards), an HR sparkline SVG (from `cardio_sessions.heart_rate` or estimated), per-exercise breakdown with trophy icons for PRs, a note textarea (saved to `workout_sessions.notes`), and "Partager" + "Sauvegarder & fermer" CTAs.
- [ ] **WORK-08**: `RestTimer` is a full-screen dark overlay (z-index 80) with a large SVG countdown ring (r=110), large M:SS countdown, −30s/Pause/+30s controls, "Reprendre maintenant" CTA, and a pulse animation when ≤5s remain.
- [ ] **WORK-09**: `WSHeader` (shared workout header) renders in dark variant during active context and light variant on summary screens.
- [ ] **WORK-10**: All workout fixtures (`SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA`) replaced with real TanStack Query hooks.

---

## PLUG-N — Nutrition Plugin

- [ ] **PLUG-N-01**: Nutrition plugin has 4 SubTabs: Aujourd'hui / Ajouter / Historique / Réglages.
- [ ] **PLUG-N-02**: Aujourd'hui tab shows an SVG calorie ring (consumed/goal ratio), 3 macro bars (P/G/L with orange fill), and a meals list grouped by meal type from `nutrition_logs` for today.
- [ ] **PLUG-N-03**: Ajouter tab has a search input + 3 quick-add shortcuts: scanner (barcode), Photo IA, and recent items. All existing add flows preserved.
- [ ] **PLUG-N-04**: Historique tab shows a 7-day bar chart (calories per day from `nutrition_logs`) and a day-selectable log list.
- [ ] **PLUG-N-05**: Réglages tab has a calorie goal slider (1 200–4 000 kcal), macro ratio sliders (P/G/L %), and units preference saved to `user_profiles`.
- [ ] **PLUG-N-06**: `AISuggestion` card appears on the Aujourd'hui tab with a personalized meal tip (rule-based: if protein < 30% of goal, suggest protein boost).
- [ ] **PLUG-N-07**: All `NUTRITION_TODAY` fixture data replaced with real TanStack Query hooks targeting `nutrition_logs`.

---

## PLUG-H — Hydration Plugin

- [ ] **PLUG-H-01**: Hydration plugin renders an SVG bottle-fill visualization (blue gradient fill level = today_ml / goal_ml).
- [ ] **PLUG-H-02**: Quick log row has 4 buttons: +250ml / +500ml / +750ml / Custom (bottom sheet input). Each calls `hydration_log` tool.
- [ ] **PLUG-H-03**: A 7-day `MiniBars` bar chart shows daily hydration vs goal.
- [ ] **PLUG-H-04**: Daily goal is editable (inline row in settings section, saved to `user_profiles`).
- [ ] **PLUG-H-05**: `WATER` fixture replaced with real data from `hydration_logs` via TanStack Query.

---

## PLUG-HAB — Habits Plugin

- [ ] **PLUG-HAB-01**: Habits plugin has 3 SubTabs: Aujourd'hui / Historique / Nouveau.
- [ ] **PLUG-HAB-02**: Aujourd'hui tab renders each habit as a row with a completion checkbox, streak dot-grid (last 7 days), and done/total count. Data from `habits` + `habit_logs`.
- [ ] **PLUG-HAB-03**: Historique tab shows a 30-day calendar heatmap (orange intensity by completion rate) and a per-habit streak list.
- [ ] **PLUG-HAB-04**: Nouveau tab has a template grid (8 habit templates with emoji icons) + custom habit form.
- [ ] **PLUG-HAB-05**: `AISuggestion` appears on Aujourd'hui with a habit streak encouragement tip.
- [ ] **PLUG-HAB-06**: `HABITS` fixture replaced with real data from `habits` + `habit_logs`.

---

## PLUG-AI — AI Programs Plugin

- [ ] **PLUG-AI-01**: AI Programs plugin has 3 SubTabs: Programme / Générer / Bibliothèque.
- [ ] **PLUG-AI-02**: Programme tab shows the active program dark hero card (name, week N/total, next session CTA). If no active program, shows an "Aucun programme actif" empty state.
- [ ] **PLUG-AI-03**: Générer tab launches `AIGenerator` wizard (DS-10 equivalent — matches WORK-03) scoped to full program generation.
- [ ] **PLUG-AI-04**: Bibliothèque tab shows a list of past `ai_generated_programs` with name, creation date, and a "Réactiver" button.
- [ ] **PLUG-AI-05**: `AISuggestion` appears with a program adaptation tip (e.g. "tu as bien récupéré, augmente la charge de 2.5 kg").
- [ ] **PLUG-AI-06**: `AI_PROGRAMS` fixture replaced with real TanStack Query hooks.

---

## PLUG-CIA — Coach IA (Persona) Plugin

- [ ] **PLUG-CIA-01**: Coach IA plugin has 2 SubTabs: Chat / Persona.
- [ ] **PLUG-CIA-02**: Chat tab renders `AIChatScreen` embedded (conversation list / active conversation with streaming dots). Credit counter ⚡N chip in the header.
- [ ] **PLUG-CIA-03**: Persona tab shows 4 persona selector cards (Max/Zoé/Léo/Rio) with avatar initials, description, and a selected state ring. Selection saved to `user_profiles` or `ai_conversations` metadata.
- [ ] **PLUG-CIA-04**: Settings rows below persona cards: language preference, coaching style (direct/encourageant/technique), response length (court/moyen/détaillé).
- [ ] **PLUG-CIA-05**: `PERSONAS` and `COACH_MESSAGES` fixtures replaced with real conversation history from `ai_messages` + `ai_conversations`.

---

## PLUG-COM — Community Plugin

- [ ] **PLUG-COM-01**: Community plugin has 3 SubTabs: Fil / Défis / Groupes.
- [ ] **PLUG-COM-02**: Fil tab shows a social activity feed (activity cards: friend name, action, ago-time, like/comment counts) from `friendships` + `workout_sessions`.
- [ ] **PLUG-COM-03**: Défis tab shows active challenges with a progress bar (user progress vs target, days remaining). Data from `challenges` table.
- [ ] **PLUG-COM-04**: Groupes tab shows groups the user belongs to (group name, member count, last activity). Data from community tables.
- [ ] **PLUG-COM-05**: `FEED` fixture replaced with real data.

---

## PLUG-STA — Stats Plugin

- [ ] **PLUG-STA-01**: Stats plugin shows a `MiniBars` chart (last 7 sessions volume), 4 stat tiles grid (séances/volume/durée/PRs this month), and a personal records list with PR weights.
- [ ] **PLUG-STA-02**: All data from `workout_sessions` + `session_sets` aggregated per period.
- [ ] **PLUG-STA-03**: `AISuggestion` with a performance trend observation.

---

## PLUG-GAM — Gamification Plugin

- [ ] **PLUG-GAM-01**: Gamification plugin shows a dark level card with XP radial progress ring (current XP / next level threshold).
- [ ] **PLUG-GAM-02**: A 2×4 badges grid shows locked (grayscale) and unlocked (colored) badges with name + unlock condition. Data from gamification tables.
- [ ] **PLUG-GAM-03**: A quests list shows active quests with progress bars and XP rewards.
- [ ] **PLUG-GAM-04**: `AISuggestion` showing next unlockable badge motivation tip.

---

## PLUG-STR — Stretching Plugin

- [ ] **PLUG-STR-01**: Stretching plugin has SubTabs: Routines / Historique / Recommandations.
- [ ] **PLUG-STR-02**: Routines tab shows user's custom routines from `stretching_routines`.
- [ ] **PLUG-STR-03**: Historique tab shows `stretching_logs` per day with duration and routine name.
- [ ] **PLUG-STR-04**: `AISuggestion` with a mobility tip.

---

## PLUG-SLP — Sleep Plugin

- [ ] **PLUG-SLP-01**: Sleep plugin main view shows a large duration display (e.g. "7h48"), a horizontal sleep stage bar (profond/léger/REM/éveillé with color segments), and a 7-day `MiniBars` chart.
- [ ] **PLUG-SLP-02**: Settings rows: target sleep duration (slider), bedtime reminder toggle.
- [ ] **PLUG-SLP-03**: `AISuggestion` with a recovery tip based on last sleep score.
- [ ] **PLUG-SLP-04**: All `SLEEP` fixture data replaced with real `sleep_logs` TanStack Query hooks.

---

## PLUG-MSR — Measurements Plugin

- [ ] **PLUG-MSR-01**: Measurements plugin shows a progress line chart (weight trend over 30 days) and latest measurement tiles (weight/fat%/waist/arm).
- [ ] **PLUG-MSR-02**: Quick log form: weight input + optional body fat % + photo capture.
- [ ] **PLUG-MSR-03**: `AISuggestion` with a body composition trend observation.

---

## PLUG-TMR — Timer Plugin

- [ ] **PLUG-TMR-01**: Timer plugin main screen shows a large dark countdown (72px monospace font), −30s/Pause/+30s controls matching `timer.jsx`.
- [ ] **PLUG-TMR-02**: A presets grid shows `timer_presets` with type chip (Tabata/HIIT/EMOM/etc).
- [ ] **PLUG-TMR-03**: The active exercise card displays during a session (exercise name + set progress).
- [ ] **PLUG-TMR-04**: "Sauvegarder comme séance" CTA triggers `workout_sessions` creation.

---

## PLUG-JNL — Journal Plugin

- [ ] **PLUG-JNL-01**: Journal plugin has a 5-emoji mood picker row (😫😕😐🙂😁), a textarea for notes, and context tag chips (pré-séance/post-séance/matin/soir).
- [ ] **PLUG-JNL-02**: History list shows `journal_entries` chronologically with mood emoji + short note preview.
- [ ] **PLUG-JNL-03**: `AISuggestion` with a mindset tip based on recent mood trend.

---

## PLUG-CRD — Cardio Plugin

- [ ] **PLUG-CRD-01**: Cardio plugin shows an activity type grid (course/vélo/rameur/marche/hyrox/functional) to start a new session.
- [ ] **PLUG-CRD-02**: Recent sessions list from `cardio_sessions` with activity icon, date, distance, duration.
- [ ] **PLUG-CRD-03**: An AI plan card suggests the next cardio based on recovery score (rule-based from `sleep_logs`).
- [ ] **PLUG-CRD-04**: `AISuggestion` with a cardio coaching tip.

---

## PLUG-SUP — Supplements Plugin

- [ ] **PLUG-SUP-01**: Supplements plugin has a product search with price comparison across `supplement_prices`.
- [ ] **PLUG-SUP-02**: `AISuggestion` with a supplement stack recommendation.

---

## PLUG-WER — Wearables Plugin

- [ ] **PLUG-WER-01**: Wearables plugin shows today's health summary: steps / heart rate / calories / sleep from `wearable_daily_summary`.
- [ ] **PLUG-WER-02**: Integration connect/disconnect CTA (Apple Health / Health Connect) matching `IntegrationsSubScreen`.
- [ ] **PLUG-WER-03**: `AISuggestion` with a health data insight.

---

## PLUG-RPE — RPE Plugin

- [ ] **PLUG-RPE-01**: RPE plugin shows a dark big-number 1RM display, 3 input controls (charge / reps / RPE), and a percentage table.
- [ ] **PLUG-RPE-02**: The calculation uses `calc1RM` from `plugins/rpe/src/index.ts` (existing) — no fixture data needed.
- [ ] **PLUG-RPE-03**: Last used values persisted in plugin Zustand store.

---

## PLUG-PAN — Pantry Plugin

- [ ] **PLUG-PAN-01**: Pantry plugin shows 3 category tiles (Frigo / Congel / Placard) with item counts from pantry tables.
- [ ] **PLUG-PAN-02**: AI recipe cards with match% (proportion of ingredients available in pantry) from existing AI recipe tools.
- [ ] **PLUG-PAN-03**: Shopping list with checked/unchecked state persisted to `shopping_list` or equivalent table.
- [ ] **PLUG-PAN-04**: `AISuggestion` with a "voici ce que tu peux cuisiner ce soir" tip.

---

## EXTRA — Extra Screens

- [ ] **EXTRA-01**: `NotificationsScreen` has filter chips (Tout/Coach IA/Communauté/Records/Système) and `NFItem` rows (icon tint, title, subtitle, unread dot, optional action button). Read from `notifications` table or push notification log.
- [ ] **EXTRA-02**: `StoreScreen` (plugins marketplace) shows featured dark cards + category chips + plugin cards with install/uninstall CTAs. Matches `extras-3.jsx`.
- [ ] **EXTRA-03**: `AIChatScreen` (standalone, outside Coach IA plugin) shows conversation list + active conversation with streaming dots + credit counter chip. Data from `ai_conversations` + `ai_messages`.
- [ ] **EXTRA-04**: `CalendarScreen` shows a monthly calendar heatmap of workout completion from `workout_sessions`.
- [ ] **EXTRA-05**: `SearchOverlay` is a full-screen search modal (exercises / programs / users) with instant results.
- [ ] **EXTRA-06**: `HelpScreen`, `LegalScreen` render static content matching existing legal pages.
- [ ] **EXTRA-07**: `EmptyState` component supports 4 variants (no data / error / offline / no search results) matching `extras.jsx`.
- [ ] **EXTRA-08**: `ErrorScreen` supports 4 variants (generic / network / auth / not-found).
- [ ] **EXTRA-09**: `AvatarUploadScreen` lets the user pick + crop a profile photo and upload via Supabase Storage signed URL.
- [ ] **EXTRA-10**: `ReferralScreen` shows user's referral code + share CTA + referred count.
- [ ] **EXTRA-11**: `ProgramBuilderScreen` is a 4-step program wizard (objectif / durée / jours / exercices) matching `extras-2.jsx`.
- [ ] **EXTRA-12**: `PostDetailScreen`, `ChallengeDetailScreen`, `LiftDetailScreen`, `GoalEditScreen` redesigned to match their mockups in `extras-2.jsx`.

---

## COACH — Coach Plugin StateC Enhancement

- [ ] **COACH-01**: `StateC` of the Mon coach plugin shows a 2-stat grid row below the coach card: "Séances suivies" count (from `workout_sessions` since link date) and "Progression %" (% of program weeks completed).
- [ ] **COACH-02**: `StateC` coach card shows "Lié depuis DD/MM/YYYY" row matching the mockup's updated layout (was missing in v1.6).
- [ ] **COACH-03**: `COACH_DATA` fixture in `plugins/coach/src/screens/CoachScreen.tsx` replaced with real data from `GET /coach/clients/links` (existing Phase 25 endpoint).

---

## DATA — Cross-Cutting Data Connections

- [ ] **DATA-01**: Every screen that previously used fixture data (`PROFILE`, `STREAK`, `TODAY`, `FORME`, `RECENT`, `NUTRITION_TODAY`, `WATER`, `HABITS`, `AI_PROGRAMS`, `PERSONAS`, `FEED`, etc.) now uses TanStack Query hooks with Supabase direct queries or Hono API calls. No `const FIXTURE = { ... }` patterns remain in production screens.
- [ ] **DATA-02**: Loading states for all data-driven screens use the design system's skeleton/placeholder pattern (consistent light gray shimmer, no spinners except full-screen initial loads).
- [ ] **DATA-03**: Empty states for all data-driven sections use the `EmptyState` component (EXTRA-07) with appropriate variant and CTA.
- [ ] **DATA-04**: Error states for all data-driven sections use the `ErrorScreen` component (EXTRA-08) or inline error banners.
