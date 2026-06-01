# Phase 40: Extra Screens — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign all auxiliary screens to match the canonical mockups (`extras.jsx`, `extras-2.jsx`, `extras-3.jsx`). Ship two new shared components (`EmptyState`, `ErrorScreen`) to `packages/ui/src/components/`. Replace all mock/fixture data with real Supabase queries.

**In scope:**
- `NotificationsScreen` (notifications.tsx) — filter chips + NFItem rows, real data
- `StoreScreen` (store/index.tsx) — featured cards + category chips + install/uninstall CTAs
- `AIChatScreen` standalone (ai/chat.tsx) — conversation list + streaming, real data
- `AvatarUploadScreen` (profile/avatar.tsx) — Supabase Storage upload
- `CalendarScreen` (calendar.tsx) — real `workout_sessions` heatmap
- `SearchOverlay` (src/components/SearchOverlay.tsx) — exercises/programs/users
- `HelpScreen` + `LegalScreen` (help.tsx / profile/help.tsx) — static redesign
- `EmptyState` component → `packages/ui/src/components/EmptyState.tsx` (4 variants)
- `ErrorScreen` component → `packages/ui/src/components/ErrorScreen.tsx` (4 variants)
- `ProgramBuilderScreen` (workout/program-builder.tsx) — 4-step wizard redesign
- `PostDetailScreen` (plugins)/community/post.tsx) — full implementation (was 8L stub)
- `ChallengeDetailScreen` (plugins)/community/challenge-detail.tsx) — full impl (was 7L stub)
- `LiftDetailScreen` (profile/lift-detail.tsx) — redesign
- `GoalEditScreen` (profile/goal-edit.tsx) — redesign
- `ReferralScreen` (profile/referral.tsx) — redesign

**Out of scope:**
- Active workout session (session.tsx)
- Any new backend Hono routes
- Native push notification SDK integration (show existing data only)
- Phase 41 items (Coach StateC, final fixture audit)

</domain>

<decisions>
## Implementation Decisions

### Notifications (EXTRA-01)
- **D-01:** `notifications.tsx` has `INITIAL_ITEMS` fixture. Replace with TanStack Query from `notifications` table (columns: `id, user_id, type TEXT, title TEXT, body TEXT, read BOOL, created_at, action_url TEXT?`). If table doesn't exist, show EmptyState with "Pas encore de notifications".
- **D-02:** Filter chips: Tout / Coach IA / Communauté / Records / Système — filter by `type` field. `all` chip shows all.
- **D-03:** NFItem = card with icon tint matching type, unread orange dot (right), title + subtitle, optional "Voir" CTA. Mark read on tap via optimistic mutation.

### Store (EXTRA-02)
- **D-04:** `store/index.tsx` already queries `plugins_registry` + `user_plugins` via Supabase (439L, real data). Primary work is visual redesign: featured dark cards (top 2–3 plugins by category = 'featured'), category chips, redesigned plugin card with proper install/uninstall CTAs. No data layer rewrite needed — refine existing queries.
- **D-05:** `store/[id].tsx` (plugin detail page) — redesign to match `extras-3.jsx` plugin detail. Check if it uses fixture data.

### AIChatScreen Standalone (EXTRA-03)
- **D-06:** `ai/chat.tsx` (501L) already functional with real `ai_conversations` + streaming. Primary work: visual redesign — conversation list sidebar/header, credit counter chip reading from real credits balance, streaming dots animation. Match `extras.jsx` AIChatScreen layout.
- **D-07:** Credit counter chip queries `user_profiles.ai_credits_balance` (or the credit system column from Phase 35 EXTRA context).

### AvatarUpload (EXTRA-09)
- **D-08:** `profile/avatar.tsx` (416L) — already exists. Check for fixture usage. Ensure: image picker (expo-image-picker), crop (or accept full), upload to `avatars/{userId}.jpg` Supabase Storage bucket, update `user_profiles.avatar_url`. Show upload progress indicator.

### Calendar (EXTRA-04)
- **D-09:** `calendar.tsx` uses `buildMockSessions` fixture. Replace with TanStack Query on `workout_sessions` for current month — group by date, show session name/type dot per day. Navigate to `workout/history` on day tap (if session exists).
- **D-10:** Keep month navigation (prev/next) — query changes by month.

### Search (EXTRA-05)
- **D-11:** `SearchOverlay.tsx` (240L) exists as a component. Ensure 3 result sections: Exercices (from `exercises`), Programmes (from `ai_generated_programs`), Utilisateurs (from `user_profiles`). Debounced input (300ms), minimum 2 chars. Shows EmptyState when no results.

### Help/Legal (EXTRA-06)
- **D-12:** `help.tsx` + `profile/help.tsx` — static content, only visual update (STGroup/STRow system for help categories). No data wiring needed.

### EmptyState + ErrorScreen (EXTRA-07, EXTRA-08)
- **D-13:** `EmptyState` variants: `no-data` (ghost icon + message + optional CTA), `error` (warning icon), `offline` (wifi-off icon), `no-results` (search icon). Props: `variant`, `title`, `message`, `ctaLabel?`, `onCta?`.
- **D-14:** `ErrorScreen` variants: `generic`, `network`, `auth`, `not-found`. Props: `variant`, `onRetry?`, `onGoBack?`.
- **D-15:** Both exported from `packages/ui/src/index.ts`. Integration: replace inline empty/error placeholders in Phase 32–39 screens lazily — only update screens where it's trivially swappable. Full sweep deferred to Phase 41.

### ProgramBuilder (EXTRA-11)
- **D-16:** `workout/program-builder.tsx` (488L) — 4-step wizard: Objectif (goal chips) / Durée (weeks slider) / Jours (day picker) / Exercices (exercise list with add/remove). Final step calls `ai_programs_generate` tool or inserts directly into `ai_generated_programs`. Redesign to match `extras-2.jsx`.

### PostDetail + ChallengeDetail (EXTRA-12)
- **D-17:** `(plugins)/community/post.tsx` is 8L stub. Implement: post header (author avatar, name, timestamp), body text + optional image, like/comment counts, comment list from `community_posts`/`post_comments` tables. Navigate back to feed.
- **D-18:** `(plugins)/community/challenge-detail.tsx` is 7L stub. Implement: challenge header (icon, name, duration, XP reward), leaderboard top 3 + current user position, participant count, join/leave CTA. Data from `challenges` + `challenge_participants`.

### LiftDetail + GoalEdit (EXTRA-12)
- **D-19:** `profile/lift-detail.tsx` (299L) — redesign to match mockup: main lift PR header, 1RM history sparkline, recent sets table, competition compare. Data from `session_sets` for that `exercise_id`.
- **D-20:** `profile/goal-edit.tsx` (312L) — redesign to match mockup: current goal display, 5 goal chips (poids/force/endurance/composition/santé), update CTA → saves to `user_profiles.goal`.

### Referral (EXTRA-10)
- **D-21:** `profile/referral.tsx` (563L) — check if this already matches Phase 35-G06 spec (migration 053 + Hono routes). If 35-G06 not yet done, implement full referral screen: user's code display, share sheet CTA, referred count (from `referrals` table), reward status chip.
- **D-22:** Since 35-G06 is a gap from Phase 35, treat Phase 40 referral work as: if `referrals` table exists → use real data; if not → show code from `user_profiles.referral_code` with referred_count = 0.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

| Ref | Path | Purpose |
|-----|------|---------|
| Requirements | `.planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md` (EXTRA-01–12) | Acceptance criteria per screen |
| Phase 35 state | `.planning/workstreams/milestone-mobile/STATE.md` | Gaps 35-G01–G07 status (referral screen may conflict) |
| Existing notifications | `apps/mobile/app/(app)/notifications.tsx` | 254L — has INITIAL_ITEMS fixture |
| Existing store | `apps/mobile/app/(app)/store/index.tsx` | 439L — has real Supabase queries, needs visual redesign |
| Existing AI chat | `apps/mobile/app/(app)/ai/chat.tsx` | 501L — functional with real AI, needs credit chip + visual |
| Existing calendar | `apps/mobile/app/(app)/calendar.tsx` | 208L — uses buildMockSessions fixture |
| Existing search | `apps/mobile/src/components/SearchOverlay.tsx` | 240L — check fixture usage |
| Existing avatar | `apps/mobile/app/(app)/profile/avatar.tsx` | 416L — check fixture/upload state |
| Existing referral | `apps/mobile/app/(app)/profile/referral.tsx` | 563L — check vs 35-G06 gap |
| Existing program-builder | `apps/mobile/app/(app)/workout/program-builder.tsx` | 488L — redesign to extras-2.jsx |
| Community post stub | `apps/mobile/app/(app)/(plugins)/community/post.tsx` | 8L stub — needs full impl |
| Community challenge stub | `apps/mobile/app/(app)/(plugins)/community/challenge-detail.tsx` | 7L stub — needs full impl |
| UI package components | `packages/ui/src/components/` | SubTabs, AISuggestion, EmptyState/ErrorScreen go here |
| UI package exports | `packages/ui/src/index.ts` | Add EmptyState + ErrorScreen exports |
| Phase 39 PLAN pattern | `.planning/workstreams/milestone-mobile/phases/39-remaining-plugins-group2/39-01-PLAN.md` | PLAN.md YAML frontmatter + must_haves pattern |

</canonical_refs>

<phase_plan>
## 6-Plan Structure

| Plan | Scope | Key files |
|------|-------|-----------|
| 40-01 | Notifications + Store redesign | notifications.tsx, store/index.tsx, store/[id].tsx |
| 40-02 | AIChatScreen + AvatarUpload | ai/chat.tsx, profile/avatar.tsx |
| 40-03 | Calendar + Search + Help/Legal | calendar.tsx, SearchOverlay.tsx, help.tsx |
| 40-04 | ProgramBuilder + PostDetail + ChallengeDetail + LiftDetail + GoalEdit + Referral | program-builder.tsx, community/post.tsx, community/challenge-detail.tsx, profile/lift-detail.tsx, profile/goal-edit.tsx, profile/referral.tsx |
| 40-05 | EmptyState + ErrorScreen components | packages/ui/src/components/EmptyState.tsx, ErrorScreen.tsx, packages/ui/src/index.ts |
| 40-06 | Phase verification | Automated checks (TypeScript clean + grep patterns + key imports) |

</phase_plan>
