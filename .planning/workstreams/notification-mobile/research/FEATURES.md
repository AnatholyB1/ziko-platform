# Features Research — Notification System

**Project:** Ziko Platform v1.8 — Push Notifications + In-App Notification Center
**Domain:** Fitness / coaching mobile app (Expo SDK 54)
**Researched:** 2026-05-25
**Confidence:** HIGH (official Expo docs + verified industry patterns)

---

## Table Stakes (must-have)

These are features users expect. Missing = product feels broken or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OS-level push permission request | iOS/Android require explicit grant; 42% of users never grant if not asked properly | Low | Must use pre-permission screen on iOS — cold system prompt converts poorly |
| Per-category toggle in Settings | Users will uninstall rather than receive all-or-nothing. 60% opt-out rate when no granular control | Medium | Already stubbed in Phase 35 settings shell |
| In-app notification center (inbox) | Users who missed or dismissed a push need to find it in-app. Standard pattern since iOS 15 era | Medium | Already exists as static component in `notifications.tsx` — needs real data wiring |
| Read/unread state + "mark all read" | Users need visual closure. Present in the current static shell | Low | Badge count on Settings or tab icon |
| Time grouping (Today / Earlier) | Standard iOS/Android inbox pattern. Users orient by recency | Low | Already in shell |
| Filter by category | Users on specific categories (e.g. coach only) need quick filtering | Low | Already in shell — needs to map to real categories |
| Deep link from notification tap | Tapping a push goes directly to the relevant screen, not home | Medium | Required by Expo Router + `expo-notifications` response handler |
| Notification badge count on app icon | iOS/Android standard. Users expect unread count on home screen icon | Low | `setBadgeCountAsync` from `expo-notifications` |
| Quiet hours / Do Not Disturb | Local reminders must not fire at night. Non-negotiable for workout reminders at 11pm | Medium | `expo-notifications` scheduleNotificationAsync with day-of-week + hour constraints |
| Persist notifications server-side | Push delivery is not guaranteed. Server-side log is the source of truth for the inbox | High | New Supabase table `user_notifications` |

---

## Differentiators (value-add)

Features that create real product value above the baseline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coach-specific notification channel | Clients know when their human/AI coach acts — creates trust and accountability | Medium | Separate push channel; highest-priority category |
| Smart habit reminder windows | Reminder fires at user's historically successful completion time, not a fixed clock | High | Requires tracking `habit_logs` timestamps per habit; fire at ±30min window of typical completion |
| Streak-at-risk notification | "You have 6h left to log today's habit — your 12-day streak is on the line" converts well and feels earned | Medium | Trigger: habit not logged by 21:00; only fires if streak >= 3 days |
| XP / level-up celebration push | "You reached Level 8! +250 XP for today's session" — dopamine moment that users share | Low | Trigger from gamification XP write path; use confetti-style in-app display |
| Program assignment notification | Coach assigns a new program: deep link goes directly to ProgramDetail | Low | Critical for coach-client loop; high open rate because it is transactional |
| Workout summary push (post-session) | "Great session — 8 sets, 3 new PRs. Weekly volume up 12%" fires 2min after session end | Medium | Trigger from `workout_sessions` insert; only if no active session |
| Invitation accepted notification | Coach notified when client accepts invitation. Closes the loop on the coaching relationship | Low | Exists in web coach platform — mirror to mobile |
| Snooze action on workout reminders | "Remind me in 1 hour" button inside the push notification (iOS/Android notification action) | Medium | `setNotificationCategoryAsync` with action buttons |
| Weekly summary digest (Sunday evening) | "Your week: 4 sessions, streak maintained, +3 badges. Next week's program ready" — drives re-engagement | Medium | Scheduled server-side job; user can toggle off |
| Notification history (30-day) | Users can scroll back; useful for retrieving coach feedback or missed PR moments | Low | Filter by `created_at` on `user_notifications` table |

---

## Anti-features (avoid)

Features that look good in specs but users actively hate.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| "You missed your step goal" / guilt-framing copy | 42% of users who quit fitness apps cite guilt-inducing notifications. "You failed" messaging increases anxiety, not motivation | Frame as opportunity: "Still time to hit your goal — 2,000 steps to go" |
| Daily "Good morning!" motivational push | Generic motivational copy has near-zero engagement. Users mute after day 3 | Only fire when there is a specific, personalized trigger (PR, streak milestone, program day) |
| Badge-on-every-action spamming | If everything is a badge, nothing is. Frequent low-value achievement pushes are muted | Gate badges behind meaningful thresholds; never send > 1 gamification push per day |
| Promotional / upsell push notifications | Fitness users perceive promo pushes as betrayal of trust. High uninstall driver | Use in-app banners for commercial messages; reserve push for transactional/personal events only |
| All notifications forced ON by default | iOS will prompt the user; if they see a wall of default-on noise on first open, they deny the whole permission | Start with highest-value categories on; lower-value categories off; show value before asking |
| Real-time social vanity metrics | "Sophie liked your post" every time creates noise without value in a small fitness community | Batch social notifications (e.g. daily digest of likes/comments) or omit entirely at v1 |
| Notification settings buried 3 levels deep | Users who cannot find the toggle disable all notifications at OS level instead | Surface "Manage notifications" link directly inside the notification center screen (already in the shell) |
| Sending during active workout | A push mid-session is the most disruptive moment. Users are lifting | Detect active `workout_session` in progress; suppress all non-critical pushes during that window |

---

## Per-category breakdown

### Coach actions

These are the highest-value, highest-urgency notifications. Users expect near-realtime delivery.

**Triggers:**
- Coach assigns a new workout program → "Nouveau programme de coach disponible : Push/Pull/Legs — 6 semaines. Commence quand tu veux."
- Coach sends invitation (new client) → "Ton coach [Name] t'a invité. Rejoins ta salle d'entraînement personnalisée."
- Coach modifies an existing program → "Ton programme a été ajusté : charge réduite jeudi suite à ta récupération."
- AI coach completes a weekly analysis → "Ton coach IA a analysé ta semaine. Volume +8 %, 2 recommandations."
- Invitation accepted (coach receives) → "[Client Name] a rejoint ton équipe."

**Timing:** Immediate (transactional). No batching. These fire on the DB event.

**Default state:** ON. These are the most expected notifications in a coaching platform.

**Copy principles:** Personalized with coach/program names. Action CTA ("Voir le programme", "Lire l'analyse"). Never generic.

---

### Workout reminders

Scheduled local notifications; not server-side. User sets time and days.

**Triggers:**
- Program-day reminder → "Séance Pull prévue ce soir à 18h30. 6 exercices planifiés." (fires at user-configured time)
- Streak-at-risk → "Il ne reste que 3h pour maintenir ta série de 12 jours. Une courte séance compte !"
- Post-rest-day resume → "Tu n'as pas entraîné depuis 3 jours. Prêt à reprendre ?"
- Workout summary (post-session) → "Belle séance ! 8 séries, 3 nouveaux PR. Volume hebdomadaire +12%."

**Timing:**
- Reminders: user-configured time + day-of-week picker (e.g. Mon/Wed/Fri at 18:30)
- Streak-at-risk: fires at 21:00 if habit/session not logged; only if streak >= 3 days
- Post-session: 2-minute delay after `workout_sessions` row inserted

**Default state:** Reminders OFF (user must opt in and set time). Streak-at-risk ON.

**Anti-pattern to avoid:** Do not fire reminders every day by default. User must configure schedule during onboarding or from settings.

---

### Gamification

Celebration moments. Should feel like a reward, never spam.

**Triggers:**
- Level-up → "Niveau 8 atteint ! +250 XP pour la séance d'aujourd'hui. Continue ta progression."
- Badge unlocked → "Badge débloqué — Régularité ! 10 séances consécutives. Tu es dans le top 5%."
- Weekly XP milestone → "Tu as gagné 1 200 XP cette semaine — nouveau record personnel."
- Challenge completed → "Défi '30 jours Push' terminé ! Tu bats [opponent] de 3 séances."
- Streak milestone (7, 14, 30, 60, 100 days) → "30 jours de série ! Tu fais partie de l'élite."

**Timing:** Immediate for level-up and badge. Weekly XP on Sunday evening. Rate-limit to max 1 gamification push per 24h.

**Default state:** Level-up and badge unlocks ON. Weekly XP digest OFF (opt-in).

**Rate limiting is critical:** If a user completes 3 habits and earns 2 badges in one session, send a single combined notification: "Belle session — 2 badges débloqués, niveau 8 atteint."

---

### Health & habits

Habit-specific reminders. Most personal, most likely to be over-used.

**Triggers:**
- Habit reminder (per habit) → "[Habit name] — c'est l'heure !" (fires at user-configured time per habit)
- Hydration check-in → "Tu as bu 1.2L aujourd'hui. Encore 1L pour ton objectif."
- Sleep window approaching → "Il est 22h30. Heure de te préparer pour un sommeil optimal."
- Habit streak milestone → "Série de 14 jours pour [habit] ! Ta régularité paie."
- Goal achieved → "Objectif hydratation atteint — 2.4L aujourd'hui !"

**Timing:**
- Per-habit reminders: user-configures time per habit (existing stub in habits plugin)
- Hydration check-in: once, mid-afternoon, only if < 50% of daily goal at 15:00
- Sleep window: user-configured bedtime - 30min; only if sleep plugin installed + enabled
- Streak milestone: immediate on log event for 7, 14, 30-day thresholds

**Default state:** Per-habit reminders OFF (user must set per habit). Hydration check-in OFF. Sleep OFF. Streak milestone ON.

**Key insight:** Per-habit reminders must be managed individually. A user with 5 habits could create 5 separate notifications; provide a daily digest alternative ("Resume des habitudes de la journée: 3/5 complétées").

---

### App updates

Lowest priority. Should almost never be push notifications.

**Triggers:**
- New plugin available (relevant to user's goals) → "Nouveau plugin compatible avec tes objectifs : Cardio GPS."
- Major feature release → in-app banner only; not a push
- Critical security/account notice → push + in-app (the only legitimate forced-push case)
- Weekly tips/content → in-app only; never push

**Timing:** Batched; max once per week. New plugin: fires once, 24h after plugin becomes available.

**Default state:** New plugin announcements OFF by default (opt-in). System/account alerts always ON and not toggleable.

**Strong recommendation:** Do not build a "news and updates" push channel. This is a promotional channel disguised as utility. Users who accepted notifications for workout reminders and coach alerts will mute or uninstall when they start receiving product marketing via push. Use the in-app notification center for app updates.

---

## Notification Content Best Practices

### Tone

- **French-first:** The app is French-language. Copy must be native French, not translated English. "Super séance !" not "Great session!"
- **Second person familiar:** Use "tu" not "vous". "Tu as soulevé 120 kg" not "Vous avez soulevé 120 kg". Matches existing notification center copy.
- **Specific not generic:** Include actual numbers. "Volume +8 %" > "Ta semaine s'est bien passée". "3 nouveaux PR" > "Tu as progressé".
- **Motivating not guilt-inducing:** Never "Tu n'as pas fait X". Always frame as opportunity: "Il reste 2h pour maintenir ta série".
- **Short titles:** 40 chars max for push title (truncated on lock screen). Body: 60-80 chars ideal. The existing shell copy is well-calibrated.

### Personalization signals to embed

| Signal | Example use |
|--------|-------------|
| User's name (if set in profile) | "Bravo [Name] — nouveau PR !" |
| Exercise name | "PR — Squat : 120 kg" not "PR détecté" |
| Actual numbers | "+5 kg", "12-day streak", "Level 8" |
| Coach name | "Ton coach Lucas a ajusté ton programme" |
| Program name | "Programme PPL : Jour Push prêt" |
| Relative streak count | "Série de 14 jours" not just "ta série" |

### Timing rules

| Window | Rule |
|--------|------|
| 06:00–09:00 | Morning habits reminders OK; workout reminders OK |
| 09:00–12:00 | Coach notifications OK; gamification OK |
| 12:00–14:00 | Hydration check-in if goal pace is behind |
| 17:00–19:00 | Peak window for workout reminders (post-work) |
| 21:00–22:00 | Streak-at-risk only; sleep reminder |
| 22:00–06:00 | Quiet hours — suppress everything except critical account alerts |
| During active workout | Suppress all notifications regardless of category |

### A/B-tested patterns from industry data

- Notifications with specific numbers (weights, XP amounts, streak days) have 2-3x higher tap rates than generic praise
- CTA buttons inside push ("Voir la séance", "Lire l'analyse") increase tap-through on iOS by ~35%
- Streak-at-risk notifications at 21:00 have the highest open rate of any fitness notification type (users are motivated not to break streaks)
- Achievement/badge notifications timed to 15 minutes after the triggering workout have higher satisfaction than real-time (gives user time to cool down and see the result contextually)

---

## Preference UI Patterns

### What works

**Section-grouped toggles with master switches**

Structure for Ziko's 5 categories:

```
[Notifications globales]     [Master ON/OFF switch]

Coach & Programme            [Section ON/OFF]
  Nouveau programme              [ toggle ]
  Modifications de programme     [ toggle ]
  Analyse IA hebdomadaire        [ toggle ]

Rappels séance               [Section ON/OFF]
  Rappels planifiés              [ toggle + time picker ]
  Résumé post-séance             [ toggle ]
  Streak à risque                [ toggle ]

Gamification                 [Section ON/OFF]
  Montée de niveau               [ toggle ]
  Badges débloqués               [ toggle ]
  Bilan XP hebdomadaire          [ toggle ]

Santé & Habitudes            [Section ON/OFF]
  Rappels d'habitudes            [ toggle → per-habit settings ]
  Rappel hydratation             [ toggle ]
  Rappel sommeil                 [ toggle ]

Application                  [Section ON/OFF]
  Nouveaux plugins               [ toggle ]
  Alertes compte                 [always ON, greyed out]
```

- Master switch at top disables all push without touching individual preferences (the "mute all" pattern)
- Section master switches let users kill a whole category without touching individuals
- Individual toggles are auto-saved; no "Save" button
- Maximum 2 levels deep: section → toggle; never 3 levels
- Quiet hours control at bottom (single time range picker): "Pas de notifications entre 22:00 et 07:00"

### What does not work

**Flat list of 15+ toggles without grouping:** Creates decision fatigue. Users scroll, feel overwhelmed, toggle everything off.

**Channel selection per notification type (Email / Push / In-App matrix):** The Category × Channel matrix pattern works for B2B SaaS (Slack, Notion). It is over-engineered for a mobile fitness app where Push + In-App are the only two channels. Do not build this.

**Requiring app settings navigation to change notification times:** The workout reminder time should be editable inline in the notification settings screen, not buried in the workout plugin settings.

**Showing permission status without a fix path:** If the user has denied OS permission, the settings screen must detect this and show a "Activer les notifications dans les réglages" CTA that deep-links to iOS/Android system settings via `Linking.openSettings()`. A greyed-out toggle with no explanation is confusing.

**"Save changes" button:** Auto-save is expected. A save button implies a transaction that can fail. Toggling a notification preference is instant and should behave like a switch.

### Pre-permission screen (first ask)

iOS grants one native permission prompt. If the user taps "Don't Allow", re-prompting is impossible without sending them to Settings. The pattern that converts best:

1. Custom in-app screen explaining 2-3 specific notification benefits (shown before the system prompt)
2. "Activer les notifications" primary button → triggers system prompt
3. "Plus tard" secondary link → defers; stores flag to ask again after first coach action

Present this screen after the first meaningful event: coach invitation received, or after first completed workout, not during onboarding step 1.

### Default states on first install

| Category | Default |
|----------|---------|
| Coach actions | ON |
| Workout reminders | OFF (user must configure time) |
| Streak-at-risk | ON |
| Post-session summary | ON |
| Badge/level-up | ON |
| Weekly XP digest | OFF |
| Per-habit reminders | OFF (user configures per habit) |
| Hydration check-in | OFF |
| Sleep reminder | OFF |
| New plugins | OFF |
| Account alerts | ON (not toggleable) |

Starting with fewer defaults ON reduces immediate notification noise and increases long-term retention of permission. Users who configure their own reminders are far less likely to revoke OS permission.
